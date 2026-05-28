/**
 * Structured errors raised by the SDK. Consumers (CLI, MCP, apps) can branch
 * on `instanceof` instead of regex-matching revert strings.
 *
 * Mapping happens via selector extraction in {@link parseContractError}:
 * we read the first 4 bytes of revert data, look it up against the known
 * custom-error selectors, and throw the appropriate subclass.
 */

import { type Address, BaseError, ContractFunctionRevertedError, keccak256, toFunctionSelector } from "viem";

export class CorpusError extends Error {
  /** Stable code consumers can switch on (NameTaken, PolicyViolation, …). */
  readonly code: string;
  /** Original viem error if available, for stack-trace continuity. */
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "CorpusError";
    this.code = code;
    this.cause = cause;
  }
}

export class NameTakenError extends CorpusError {
  readonly legalName: string;
  readonly existingManager: Address;
  constructor(legalName: string, existingManager: Address, cause?: unknown) {
    super(
      "NAME_TAKEN",
      `Legal name "${legalName}" is already registered to ${existingManager}`,
      cause,
    );
    this.name = "NameTakenError";
    this.legalName = legalName;
    this.existingManager = existingManager;
  }
}

export class EmptyNameError extends CorpusError {
  constructor(cause?: unknown) {
    super("EMPTY_NAME", "Legal name cannot be empty", cause);
    this.name = "EmptyNameError";
  }
}

export class NotPrincipalError extends CorpusError {
  constructor(cause?: unknown) {
    super("NOT_PRINCIPAL", "Caller is not the principal", cause);
    this.name = "NotPrincipalError";
  }
}

export class NotMediatorError extends CorpusError {
  constructor(cause?: unknown) {
    super("NOT_MEDIATOR", "Caller is not the mediator", cause);
    this.name = "NotMediatorError";
  }
}

export class CounterpartyNotAllowedError extends CorpusError {
  constructor(cause?: unknown) {
    super("COUNTERPARTY_NOT_ALLOWED", "Counterparty is not on the allowlist", cause);
    this.name = "CounterpartyNotAllowedError";
  }
}

export class DailyCapExceededError extends CorpusError {
  constructor(cause?: unknown) {
    super("DAILY_CAP_EXCEEDED", "Payment would exceed the daily spending cap", cause);
    this.name = "DailyCapExceededError";
  }
}

export class DisputeNotOpenError extends CorpusError {
  constructor(cause?: unknown) {
    super("DISPUTE_NOT_OPEN", "Dispute is not in Open state", cause);
    this.name = "DisputeNotOpenError";
  }
}

export class AwardExceedsClaimError extends CorpusError {
  constructor(cause?: unknown) {
    super("AWARD_EXCEEDS_CLAIM", "Award is greater than the amount at issue", cause);
    this.name = "AwardExceedsClaimError";
  }
}

export class NotCounterpartyError extends CorpusError {
  constructor(cause?: unknown) {
    super(
      "NOT_COUNTERPARTY",
      "Counterparty has no prior payment history with this entity",
      cause,
    );
    this.name = "NotCounterpartyError";
  }
}

export class DisputeCooldownError extends CorpusError {
  constructor(cause?: unknown) {
    super("DISPUTE_COOLDOWN", "Per-counterparty dispute cooldown is still active", cause);
    this.name = "DisputeCooldownError";
  }
}

export class PrincipalMediatorCollisionError extends CorpusError {
  constructor(cause?: unknown) {
    super(
      "PRINCIPAL_MEDIATOR_COLLISION",
      "Principal and mediator cannot be the same address",
      cause,
    );
    this.name = "PrincipalMediatorCollisionError";
  }
}

export class ZeroAddressError extends CorpusError {
  constructor(cause?: unknown) {
    super("ZERO_ADDRESS", "Address argument cannot be the zero address", cause);
    this.name = "ZeroAddressError";
  }
}

// ── Selector → constructor map ──────────────────────────────────────────────
// Mapping built lazily so it stays in sync with the ABI without manual byte work.
const SELECTORS = new Map<string, (data: string) => CorpusError>([
  [sel("EmptyLegalName()"), () => new EmptyNameError()],
  [sel("NotPrincipal()"), () => new NotPrincipalError()],
  [sel("NotMediator()"), () => new NotMediatorError()],
  [sel("CounterpartyNotAllowed()"), () => new CounterpartyNotAllowedError()],
  [sel("DailyCapExceeded()"), () => new DailyCapExceededError()],
  [sel("DisputeNotOpen()"), () => new DisputeNotOpenError()],
  [sel("AwardExceedsClaim()"), () => new AwardExceedsClaimError()],
  [sel("NotCounterparty()"), () => new NotCounterpartyError()],
  [sel("DisputeCooldown()"), () => new DisputeCooldownError()],
  [sel("PrincipalMediatorCollision()"), () => new PrincipalMediatorCollisionError()],
  [sel("ZeroAddress()"), () => new ZeroAddressError()],
]);

function sel(sig: string): string {
  return toFunctionSelector(`error ${sig}`).toLowerCase();
}

/**
 * Try to extract a structured CorpusError from an unknown thrown value.
 * Returns the original error untouched if no match. Use at the top of every
 * write method's catch block.
 */
export function mapContractError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;

  // viem wraps custom errors in nested BaseError chains — drill down
  let revertData: string | undefined;
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      revertData = reverted.data?.errorName
        ? toFunctionSelector(`error ${reverted.data.errorName}(${reverted.data.args?.map(() => "").join(",") ?? ""})`)
        : (reverted as { signature?: string }).signature;
      if (reverted.data?.errorName === "NameAlreadyTaken") {
        const args = reverted.data.args as readonly [string, Address] | undefined;
        if (args) return new NameTakenError(args[0], args[1], err);
      }
      if (reverted.data?.errorName) {
        const sig = `${reverted.data.errorName}()`;
        const selector = sel(sig);
        const factory = SELECTORS.get(selector);
        if (factory) return factory(selector);
      }
    }
    // Fallback: search the raw error string for selectors
    const raw = (err as { details?: string; shortMessage?: string }).details
      ?? (err as { shortMessage?: string }).shortMessage
      ?? err.message;
    if (raw) {
      const match = raw.match(/0x[0-9a-fA-F]{8}/);
      if (match) {
        const factory = SELECTORS.get(match[0].toLowerCase());
        if (factory) return factory(match[0]);
      }
    }
  }
  void revertData;
  return err;
}

/** Re-export keccak256 so consumers can hash memos/evidence consistently. */
export { keccak256 };
