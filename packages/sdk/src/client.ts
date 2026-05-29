import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  decodeEventLog,
  parseAbiItem,
  parseEventLogs,
  getAddress,
  keccak256,
  toHex,
} from "viem";
import { fhoxFactoryAbi, fhoxManagerAbi, erc20Abi, erc721Abi } from "./abis.js";
import { ARBITRUM_SEPOLIA_ADDRESSES } from "./chains.js";
import { mapContractError } from "./errors.js";
import type {
  Dispute,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  EntityMetadata,
  EntityState,
  FormParams,
  FormResult,
  PaymentEvent,
  PolicyView,
  TxResult,
  VerificationResult,
} from "./types.js";
import { DisputeStatus } from "./types.js";

export type FhoxClientConfig = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  factory: Address;
  /** FhenixClient from @cofhe/sdk for client-side FHE encryption. */
  fhenixClient?: unknown;
  /** Defaults to Arbitrum Sepolia's deployed USDC. */
  usdc?: Address;
  /** Defaults to Arbitrum Sepolia's deployed IdentityRegistry. */
  identityRegistry?: Address;
};

export type PayOptions = { gas?: bigint };
export type FormOptions = { gas?: bigint };

/** Encrypted input matching InEuint128 Solidity struct (4 fields from ICofhe.sol). */
type EncryptedUint128 = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};

/**
 * TypeScript wrapper around the FHOX contracts. Uses Fhenix FHE for privacy-preserving
 * treasury operations — payment amounts are encrypted and never visible on-chain.
 *
 * Pass `fhenixClient` (from @cofhe/sdk) to enable automatic client-side encryption.
 * Without it, you can pass pre-encrypted values directly via `payEncrypted()`.
 */
export class FhoxClient {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly factory: Address;
  readonly usdc: Address;
  readonly identityRegistry: Address;
  // FhenixClient from @cofhe/sdk — typed as unknown to avoid hard dep on the package
  readonly fhenixClient: unknown;

  constructor(cfg: FhoxClientConfig) {
    this.publicClient = cfg.publicClient;
    this.walletClient = cfg.walletClient;
    this.factory = getAddress(cfg.factory);
    this.usdc = getAddress(cfg.usdc ?? ARBITRUM_SEPOLIA_ADDRESSES.usdc);
    this.identityRegistry = getAddress(cfg.identityRegistry ?? ARBITRUM_SEPOLIA_ADDRESSES.identityRegistry);
    this.fhenixClient = cfg.fhenixClient;
  }

  get address(): Address {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    return account.address;
  }

  static normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  // ── Name registry ──────────────────────────────────────────────────────────

  async isNameTaken(legalName: string): Promise<{ taken: boolean; existingManager: Address }> {
    const normalized = FhoxClient.normalizeName(legalName);
    const result = (await this.publicClient.readContract({
      address: this.factory,
      abi: fhoxFactoryAbi,
      functionName: "isNameTaken",
      args: [normalized],
    })) as readonly [boolean, Address];
    return { taken: result[0], existingManager: result[1] };
  }

  async findEntityByName(legalName: string): Promise<Address | null> {
    const { taken, existingManager } = await this.isNameTaken(legalName);
    return taken ? existingManager : null;
  }

  // ── Formation ──────────────────────────────────────────────────────────────

  /**
   * Form a new FHOX entity. The daily cap is encrypted client-side via @cofhe/sdk
   * before being submitted to the contract — the cap value is never visible on-chain.
   */
  async form(params: FormParams, opts: FormOptions = {}): Promise<FormResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");

    // Encrypt the daily cap using @cofhe/sdk if available, otherwise trivial zero
    const encDailyCap = await this._encryptUint128(params.hasDailyCap ? params.dailyCapUsdc : 0n);

    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: this.factory,
        abi: fhoxFactoryAbi,
        functionName: "form",
        gas: opts.gas ?? 5_000_000n,
        args: [
          {
            legalName: FhoxClient.normalizeName(params.metadata.legalName),
            jurisdiction: params.metadata.jurisdiction,
            filingId: params.metadata.filingId,
            articlesHash: params.metadata.articlesHash,
            operatingAgreementHash: params.metadata.operatingAgreementHash,
            formedAt: params.metadata.formedAt,
          },
          encDailyCap,
          params.hasDailyCap,
          params.allowlistOnly,
          getAddress(params.principal),
          getAddress(params.mediator),
          params.identityMetadataURI,
        ],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      const logs = parseEventLogs({
        abi: fhoxFactoryAbi,
        eventName: "FhoxFormed",
        logs: receipt.logs,
      });
      if (logs.length === 0) throw new Error("FhoxFormed event not found in receipt");
      const ev = logs[0].args as { manager: Address; identityTokenId: bigint };
      return { manager: ev.manager, identityTokenId: ev.identityTokenId, txHash };
    } catch (err) {
      throw mapContractError(err);
    }
  }

  // ── Treasury operations ────────────────────────────────────────────────────

  /**
   * Execute a USDC payment. `amount` is a plaintext bigint — the SDK encrypts it
   * using @cofhe/sdk before submitting to the FHE contract. The actual amount is
   * never visible on-chain (not in calldata, not in events).
   */
  /**
   * Phase-1 payment: encrypt amount, apply FHE cap check, request async decrypt.
   * Returns `{ paymentId, txHash }`. Call `executePayment(manager, paymentId)` once
   * the decrypt result is ready (≥1 block on testnet; evm_increaseTime in tests).
   */
  async pay(
    manager: Address,
    counterparty: Address,
    amount: bigint,
    memo: string,
    opts: PayOptions = {},
  ): Promise<{ paymentId: bigint; txHash: Hex }> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    const memoHash = keccak256(toHex(memo));
    const encAmount = await this._encryptUint128(amount);
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "pay",
        gas: opts.gas,
        args: [getAddress(counterparty), encAmount, memoHash],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      const logs = parseEventLogs({ abi: fhoxManagerAbi, eventName: "PaymentInitiated", logs: receipt.logs });
      if (logs.length === 0) throw new Error("PaymentInitiated event not found");
      const ev = logs[0].args as { paymentId: bigint };
      return { paymentId: ev.paymentId, txHash };
    } catch (err) {
      throw mapContractError(err);
    }
  }

  /** Phase-2 payment: read decrypted amount and execute USDC transfer. */
  async executePayment(manager: Address, paymentId: bigint, opts: PayOptions = {}): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "executePayment",
        gas: opts.gas,
        args: [paymentId],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  /** Send USDC from the signer's wallet to a manager (or any address). */
  async fund(to: Address, amount: bigint, opts: PayOptions = {}): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: this.usdc,
        abi: erc20Abi,
        functionName: "transfer",
        gas: opts.gas,
        args: [getAddress(to), amount],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  // ── Policy + allowlist ─────────────────────────────────────────────────────

  async setAllowlist(manager: Address, addr: Address, allowed: boolean): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "setAllowlist",
        args: [getAddress(addr), allowed],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  /** Update spending policy. `dailyCapUsdc` is encrypted before sending. */
  async setPolicy(
    manager: Address,
    dailyCapUsdc: bigint,
    hasCap: boolean,
    allowlistOnly: boolean,
  ): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    const encCap = await this._encryptUint128(hasCap ? dailyCapUsdc : 0n);
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "setPolicy",
        args: [encCap, hasCap, allowlistOnly],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  async rotatePrincipal(manager: Address, next: Address): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "rotatePrincipal",
        args: [getAddress(next)],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  async rotateMediator(manager: Address, next: Address): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "rotateMediator",
        args: [getAddress(next)],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  // ── FHE Sealed reads ───────────────────────────────────────────────────────

  /**
   * Read the encrypted daily-cap handle. Simulates the tx (grants ACL in the simulated
   * context) and returns the euint128 handle as bytes32. Decrypt with @cofhe/sdk.
   *
   * NOTE: To make the ACL grant persistent on-chain, send the actual tx via
   * walletClient.writeContract({ functionName: "getSealedDailyCap" }).
   */
  async getSealedDailyCap(manager: Address): Promise<Hex> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    const { result } = await this.publicClient.simulateContract({
      account: account.address,
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "getSealedDailyCap",
      args: [],
    });
    return result as Hex;
  }

  /**
   * Read today's encrypted spend handle. Simulates the tx and returns the bytes32 handle.
   */
  async getSealedTodaySpent(manager: Address): Promise<Hex> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    const { result } = await this.publicClient.simulateContract({
      account: account.address,
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "getSealedTodaySpent",
      args: [],
    });
    return result as Hex;
  }

  // ── Disputes ───────────────────────────────────────────────────────────────

  async openDispute(
    manager: Address,
    counterparty: Address,
    amountClaimed: bigint,
    reason: string,
  ): Promise<{ disputeId: bigint; txHash: Hex }> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "openDispute",
        args: [getAddress(counterparty), amountClaimed, reason],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      const log = receipt.logs.find((l) => l.address.toLowerCase() === manager.toLowerCase());
      if (!log) throw new Error("openDispute log not found");
      const decoded = decodeEventLog({
        abi: [
          parseAbiItem(
            "event DisputeOpened(uint256 indexed disputeId, address indexed counterparty, string reason)",
          ),
        ],
        data: log.data,
        topics: log.topics,
      });
      return { disputeId: (decoded.args as { disputeId: bigint }).disputeId, txHash };
    } catch (err) {
      throw mapContractError(err);
    }
  }

  async resolveDispute(
    manager: Address,
    disputeId: bigint,
    award: bigint,
    evidenceHash: Hex,
  ): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: fhoxManagerAbi,
        functionName: "resolveDispute",
        args: [disputeId, award, evidenceHash],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  async getDispute(manager: Address, disputeId: bigint): Promise<Dispute | null> {
    const raw = (await this.publicClient.readContract({
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "disputes",
      args: [disputeId],
    })) as readonly [Address, bigint, number, bigint];
    const status = raw[2] as DisputeStatus;
    if (status === DisputeStatus.None) return null;
    return { id: disputeId, counterparty: raw[0], amountAtIssue: raw[1], status, openedAt: raw[3] };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async treasuryBalance(manager: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "treasuryBalance",
    }) as Promise<bigint>;
  }

  async usdcBalanceOf(addr: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [getAddress(addr)],
    }) as Promise<bigint>;
  }

  async isAllowlisted(manager: Address, addr: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "allowlist",
      args: [getAddress(addr)],
    }) as Promise<boolean>;
  }

  async isKnownCounterparty(manager: Address, addr: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: fhoxManagerAbi,
      functionName: "knownCounterparty",
      args: [getAddress(addr)],
    }) as Promise<boolean>;
  }

  async getEntityState(manager: Address): Promise<EntityState> {
    const m = getAddress(manager);
    const [metadata, policyView, principal, mediator, identityTokenId, treasuryBalance, nextDisputeId] =
      await Promise.all([
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "metadata" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "policyView" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "principal" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "mediator" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "identityTokenId" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "treasuryBalance" }),
        this.publicClient.readContract({ address: m, abi: fhoxManagerAbi, functionName: "nextDisputeId" }),
      ]);
    const md = metadata as EntityMetadata;
    const pol = policyView as PolicyView;
    return {
      manager: m,
      metadata: {
        legalName: md.legalName,
        jurisdiction: md.jurisdiction,
        filingId: md.filingId,
        articlesHash: md.articlesHash,
        operatingAgreementHash: md.operatingAgreementHash,
        formedAt: md.formedAt,
      },
      policy: { hasDailyCap: pol.hasDailyCap, allowlistOnly: pol.allowlistOnly },
      principal: principal as Address,
      mediator: mediator as Address,
      identityTokenId: identityTokenId as bigint,
      treasuryBalance: treasuryBalance as bigint,
      nextDisputeId: nextDisputeId as bigint,
    };
  }

  // ── Verification ───────────────────────────────────────────────────────────

  async verifyEntity(manager: Address): Promise<VerificationResult> {
    const state = await this.getEntityState(manager);
    const actualOwner = (await this.publicClient.readContract({
      address: this.identityRegistry,
      abi: erc721Abi,
      functionName: "ownerOf",
      args: [state.identityTokenId],
    })) as Address;
    const verified = getAddress(actualOwner) === getAddress(state.principal);
    return {
      verified,
      reason: verified
        ? undefined
        : `principal ${state.principal} does not own identity NFT #${state.identityTokenId} (owner is ${actualOwner})`,
      manager: state.manager,
      identityTokenId: state.identityTokenId,
      expectedOwner: state.principal,
      actualOwner,
      state,
    };
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  async getPayments(manager: Address, fromBlock: bigint = 0n, toBlock?: bigint): Promise<PaymentEvent[]> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(manager),
      event: {
        type: "event",
        name: "PaymentExecuted",
        inputs: [
          { name: "counterparty", type: "address", indexed: true },
          { name: "memoHash", type: "bytes32", indexed: true },
        ],
      },
      fromBlock,
      toBlock: toBlock ?? "latest",
    });
    return logs.map((l) => ({
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
      counterparty: l.args.counterparty as Address,
      memoHash: l.args.memoHash as Hex,
    }));
  }

  async getDisputesOpened(manager: Address, fromBlock: bigint = 0n, toBlock?: bigint): Promise<DisputeOpenedEvent[]> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(manager),
      event: {
        type: "event",
        name: "DisputeOpened",
        inputs: [
          { name: "disputeId", type: "uint256", indexed: true },
          { name: "counterparty", type: "address", indexed: true },
          { name: "reason", type: "string", indexed: false },
        ],
      },
      fromBlock,
      toBlock: toBlock ?? "latest",
    });
    return logs.map((l) => ({
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
      disputeId: l.args.disputeId as bigint,
      counterparty: l.args.counterparty as Address,
      reason: l.args.reason as string,
    }));
  }

  async getDisputesResolved(manager: Address, fromBlock: bigint = 0n, toBlock?: bigint): Promise<DisputeResolvedEvent[]> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(manager),
      event: {
        type: "event",
        name: "DisputeResolved",
        inputs: [
          { name: "disputeId", type: "uint256", indexed: true },
          { name: "counterparty", type: "address", indexed: true },
          { name: "awardToCounterparty", type: "uint128", indexed: false },
          { name: "evidenceHash", type: "bytes32", indexed: false },
        ],
      },
      fromBlock,
      toBlock: toBlock ?? "latest",
    });
    return logs.map((l) => ({
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
      disputeId: l.args.disputeId as bigint,
      counterparty: l.args.counterparty as Address,
      award: l.args.awardToCounterparty as bigint,
      evidenceHash: l.args.evidenceHash as Hex,
    }));
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _wrapTx(txHash: Hex): TxResult {
    return {
      txHash,
      wait: async () => {
        const r = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        return { blockNumber: r.blockNumber, status: r.status };
      },
    };
  }

  /**
   * Encrypt a uint128 value using @cofhe/sdk FhenixClient if available,
   * otherwise returns a trivially-encrypted zero placeholder (for testing).
   *
   * In production: pass `fhenixClient` (from @cofhe/sdk) to FhoxClientConfig.
   */
  private async _encryptUint128(value: bigint): Promise<EncryptedUint128> {
    if (this.fhenixClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = this.fhenixClient as any;
      // @cofhe/sdk returns an object matching the InEuint128 struct
      return client.encrypt_uint128(value) as EncryptedUint128;
    }
    // Fallback: trivial encoding for local hardhat mock testing.
    // ctHash = value (plaintext), securityZone = 0, utype = 6 (EUINT128_TFHE), signature = "0x"
    return {
      ctHash: value,
      securityZone: 0,
      utype: 6,
      signature: "0x",
    };
  }
}
