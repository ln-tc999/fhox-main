import type { Address, Hex } from "viem";

export type EntityMetadata = {
  legalName: string;
  jurisdiction: string;
  /** Wyoming Secretary of State filing ID. Empty string = protocol-only formation. */
  filingId: string;
  /** keccak256 of the Articles of Organization PDF (pinned off-chain). */
  articlesHash: Hex;
  /** keccak256 of the Operating Agreement PDF. */
  operatingAgreementHash: Hex;
  /** block.timestamp at formation. Pass 0 — the contract overwrites this with block.timestamp. */
  formedAt: bigint;
};

/** Public view of spending policy. The actual cap value is FHE-encrypted and private. */
export type PolicyView = {
  hasDailyCap: boolean;
  allowlistOnly: boolean;
};

export type FormParams = {
  metadata: EntityMetadata;
  /** Plaintext daily cap in USDC (6 decimals). SDK encrypts this before sending. 0 = no cap. */
  dailyCapUsdc: bigint;
  hasDailyCap: boolean;
  allowlistOnly: boolean;
  principal: Address;
  mediator: Address;
  /** Off-chain metadata for the ERC-8004 identity (ipfs:// or https://). */
  identityMetadataURI: string;
};

export type FormResult = {
  manager: Address;
  identityTokenId: bigint;
  txHash: Hex;
};

export enum DisputeStatus {
  None = 0,
  Open = 1,
  Resolved = 2,
}

export type Dispute = {
  id: bigint;
  counterparty: Address;
  amountAtIssue: bigint;
  status: DisputeStatus;
  openedAt: bigint;
};

/** Snapshot of an entity's on-chain state. Financial amounts are encrypted — use getSealedDailyCap / getSealedTodaySpent to read them. */
export type EntityState = {
  manager: Address;
  metadata: EntityMetadata;
  policy: PolicyView;
  principal: Address;
  mediator: Address;
  identityTokenId: bigint;
  treasuryBalance: bigint;
  nextDisputeId: bigint;
};

export type VerificationResult = {
  verified: boolean;
  reason?: string;
  manager: Address;
  identityTokenId: bigint;
  expectedOwner: Address;
  actualOwner: Address;
  state: EntityState;
};

/** Payment event — amount is intentionally absent (FHE-private). */
export type PaymentEvent = {
  blockNumber: bigint;
  txHash: Hex;
  counterparty: Address;
  memoHash: Hex;
};

export type DisputeOpenedEvent = {
  blockNumber: bigint;
  txHash: Hex;
  disputeId: bigint;
  counterparty: Address;
  reason: string;
};

export type DisputeResolvedEvent = {
  blockNumber: bigint;
  txHash: Hex;
  disputeId: bigint;
  counterparty: Address;
  award: bigint;
  evidenceHash: Hex;
};

/** Result of a write transaction. Call `wait()` to block until included. */
export type TxResult = {
  txHash: Hex;
  wait: () => Promise<{ blockNumber: bigint; status: "success" | "reverted" }>;
};

/** FHE Permission for sealed-output reads (produced by @cofhe/sdk getPermit). */
export type FhePermission = {
  publicKey: Hex;
  signature: Hex;
};
