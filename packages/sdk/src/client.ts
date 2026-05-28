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
import { corpusFactoryAbi, corpusManagerAbi, erc20Abi, erc721Abi } from "./abis.js";
import { ARC_TESTNET_ADDRESSES } from "./chains.js";
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
  SpendingPolicy,
  TxResult,
  VerificationResult,
} from "./types.js";
import { DisputeStatus } from "./types.js";

export type CorpusClientConfig = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  factory: Address;
  /** Defaults to Arc Testnet's canonical USDC. */
  usdc?: Address;
  /** Defaults to Arc Testnet's ERC-8004 IdentityRegistry. */
  identityRegistry?: Address;
};

export type PayOptions = { gas?: bigint };
export type FormOptions = { gas?: bigint };

/**
 * Thin TypeScript wrapper around the CORPUS contracts. Holds a viem public + wallet client
 * pair and the deployed Factory address. Designed to be embedded inside any agent runtime
 * (server, edge function, browser, MCP server, CLI).
 */
export class CorpusClient {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly factory: Address;
  readonly usdc: Address;
  readonly identityRegistry: Address;

  constructor(cfg: CorpusClientConfig) {
    this.publicClient = cfg.publicClient;
    this.walletClient = cfg.walletClient;
    this.factory = getAddress(cfg.factory);
    this.usdc = getAddress(cfg.usdc ?? ARC_TESTNET_ADDRESSES.usdc);
    this.identityRegistry = getAddress(cfg.identityRegistry ?? ARC_TESTNET_ADDRESSES.identityRegistry);
  }

  // ── Account convenience ────────────────────────────────────────────────────

  /** The address of the signer attached to this client. Throws if no account is set. */
  get address(): Address {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    return account.address;
  }

  /** Normalize a legal name the same way the contract does (trim + collapse whitespace). */
  static normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }

  // ── Name registry ──────────────────────────────────────────────────────────

  /** Check whether a legal name is already registered on this factory. */
  async isNameTaken(legalName: string): Promise<{ taken: boolean; existingManager: Address }> {
    const normalized = CorpusClient.normalizeName(legalName);
    const result = (await this.publicClient.readContract({
      address: this.factory,
      abi: corpusFactoryAbi,
      functionName: "isNameTaken",
      args: [normalized],
    })) as readonly [boolean, Address];
    return { taken: result[0], existingManager: result[1] };
  }

  /** Resolve a legal name to its manager address, or null if not registered. */
  async findEntityByName(legalName: string): Promise<Address | null> {
    const { taken, existingManager } = await this.isNameTaken(legalName);
    return taken ? existingManager : null;
  }

  // ── Formation ──────────────────────────────────────────────────────────────

  /** Form a new CORPUS entity. Returns the manager address + minted identity token ID. */
  async form(params: FormParams, opts: FormOptions = {}): Promise<FormResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");

    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: this.factory,
        abi: corpusFactoryAbi,
        functionName: "form",
        gas: opts.gas ?? 3_000_000n,
        args: [
          {
            legalName: CorpusClient.normalizeName(params.metadata.legalName),
            jurisdiction: params.metadata.jurisdiction,
            filingId: params.metadata.filingId,
            articlesHash: params.metadata.articlesHash,
            operatingAgreementHash: params.metadata.operatingAgreementHash,
            formedAt: params.metadata.formedAt,
          },
          {
            dailyCapUsdc: params.policy.dailyCapUsdc,
            allowlistOnly: params.policy.allowlistOnly,
          },
          getAddress(params.principal),
          getAddress(params.mediator),
          params.identityMetadataURI,
        ],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      const logs = parseEventLogs({
        abi: corpusFactoryAbi,
        eventName: "CorpusFormed",
        logs: receipt.logs,
      });
      if (logs.length === 0) throw new Error("CorpusFormed event not found in receipt");
      const ev = logs[0].args as { manager: Address; identityTokenId: bigint };
      return { manager: ev.manager, identityTokenId: ev.identityTokenId, txHash };
    } catch (err) {
      throw mapContractError(err);
    }
  }

  // ── Treasury operations ────────────────────────────────────────────────────

  /** Execute a USDC payment from the entity's treasury under its spending policy. */
  async pay(
    manager: Address,
    counterparty: Address,
    amount: bigint,
    memo: string,
    opts: PayOptions = {},
  ): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    const memoHash = keccak256(toHex(memo));
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: corpusManagerAbi,
        functionName: "pay",
        gas: opts.gas,
        args: [getAddress(counterparty), amount, memoHash],
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
        abi: corpusManagerAbi,
        functionName: "setAllowlist",
        args: [getAddress(addr), allowed],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  async setPolicy(manager: Address, policy: SpendingPolicy): Promise<TxResult> {
    const account = this.walletClient.account;
    if (!account) throw new Error("walletClient.account is required");
    try {
      const txHash = await this.walletClient.writeContract({
        account,
        chain: this.walletClient.chain,
        address: getAddress(manager),
        abi: corpusManagerAbi,
        functionName: "setPolicy",
        args: [{ dailyCapUsdc: policy.dailyCapUsdc, allowlistOnly: policy.allowlistOnly }],
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
        abi: corpusManagerAbi,
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
        abi: corpusManagerAbi,
        functionName: "rotateMediator",
        args: [getAddress(next)],
      });
      return this._wrapTx(txHash);
    } catch (err) {
      throw mapContractError(err);
    }
  }

  // ── Disputes ───────────────────────────────────────────────────────────────

  /** Open a dispute against the entity. Returns the new disputeId. */
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
        abi: corpusManagerAbi,
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

  /** Mediator-only: deliver a binding resolution. */
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
        abi: corpusManagerAbi,
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
      abi: corpusManagerAbi,
      functionName: "disputes",
      args: [disputeId],
    })) as readonly [Address, bigint, number, bigint];
    const status = raw[2] as DisputeStatus;
    if (status === DisputeStatus.None) return null;
    return {
      id: disputeId,
      counterparty: raw[0],
      amountAtIssue: raw[1],
      status,
      openedAt: raw[3],
    };
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async treasuryBalance(manager: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: corpusManagerAbi,
      functionName: "treasuryBalance",
    }) as Promise<bigint>;
  }

  async todaySpent(manager: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: corpusManagerAbi,
      functionName: "todaySpent",
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
      abi: corpusManagerAbi,
      functionName: "allowlist",
      args: [getAddress(addr)],
    }) as Promise<boolean>;
  }

  async isKnownCounterparty(manager: Address, addr: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: getAddress(manager),
      abi: corpusManagerAbi,
      functionName: "knownCounterparty",
      args: [getAddress(addr)],
    }) as Promise<boolean>;
  }

  /** Read the full on-chain state of an entity in one call. */
  async getEntityState(manager: Address): Promise<EntityState> {
    const m = getAddress(manager);
    const [metadata, policy, principal, mediator, identityTokenId, treasuryBalance, todaySpent, nextDisputeId] =
      await Promise.all([
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "metadata" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "policy" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "principal" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "mediator" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "identityTokenId" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "treasuryBalance" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "todaySpent" }),
        this.publicClient.readContract({ address: m, abi: corpusManagerAbi, functionName: "nextDisputeId" }),
      ]);
    const md = metadata as EntityMetadata;
    const pol = policy as SpendingPolicy;
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
      policy: { dailyCapUsdc: pol.dailyCapUsdc, allowlistOnly: pol.allowlistOnly },
      principal: principal as Address,
      mediator: mediator as Address,
      identityTokenId: identityTokenId as bigint,
      treasuryBalance: treasuryBalance as bigint,
      todaySpent: todaySpent as bigint,
      nextDisputeId: nextDisputeId as bigint,
    };
  }

  // ── Verification ───────────────────────────────────────────────────────────

  /**
   * Cryptographic verification: the manager's recorded identityTokenId must
   * be owned (on the IdentityRegistry NFT contract) by the manager's recorded principal.
   * This proves no one tampered with the link between the LLC and the agent.
   */
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

  /** Fetch historical PaymentExecuted events. */
  async getPayments(manager: Address, fromBlock: bigint = 0n, toBlock?: bigint): Promise<PaymentEvent[]> {
    const logs = await this.publicClient.getLogs({
      address: getAddress(manager),
      event: {
        type: "event",
        name: "PaymentExecuted",
        inputs: [
          { name: "counterparty", type: "address", indexed: true },
          { name: "amount", type: "uint128", indexed: false },
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
      amount: l.args.amount as bigint,
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

  async getDisputesResolved(
    manager: Address,
    fromBlock: bigint = 0n,
    toBlock?: bigint,
  ): Promise<DisputeResolvedEvent[]> {
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
}
