import { type Address, BaseError, ContractFunctionRevertedError, keccak256, toFunctionSelector } from "viem";

export class FhoxError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "FhoxError";
    this.code = code;
    this.cause = cause;
  }
}

export class NameTakenError extends FhoxError {
  readonly legalName: string;
  readonly existingManager: Address;
  constructor(legalName: string, existingManager: Address, cause?: unknown) {
    super("NAME_TAKEN", `Legal name "${legalName}" is already registered to ${existingManager}`, cause);
    this.name = "NameTakenError";
    this.legalName = legalName;
    this.existingManager = existingManager;
  }
}

export class EmptyNameError extends FhoxError {
  constructor(cause?: unknown) {
    super("EMPTY_NAME", "Legal name cannot be empty", cause);
    this.name = "EmptyNameError";
  }
}

export class NotPrincipalError extends FhoxError {
  constructor(cause?: unknown) {
    super("NOT_PRINCIPAL", "Caller is not the principal", cause);
    this.name = "NotPrincipalError";
  }
}

export class NotMediatorError extends FhoxError {
  constructor(cause?: unknown) {
    super("NOT_MEDIATOR", "Caller is not the mediator", cause);
    this.name = "NotMediatorError";
  }
}

export class CounterpartyNotAllowedError extends FhoxError {
  constructor(cause?: unknown) {
    super("COUNTERPARTY_NOT_ALLOWED", "Counterparty is not on the allowlist", cause);
    this.name = "CounterpartyNotAllowedError";
  }
}

export class DisputeNotOpenError extends FhoxError {
  constructor(cause?: unknown) {
    super("DISPUTE_NOT_OPEN", "Dispute is not in Open state", cause);
    this.name = "DisputeNotOpenError";
  }
}

export class AwardExceedsClaimError extends FhoxError {
  constructor(cause?: unknown) {
    super("AWARD_EXCEEDS_CLAIM", "Award is greater than the amount at issue", cause);
    this.name = "AwardExceedsClaimError";
  }
}

export class NotCounterpartyError extends FhoxError {
  constructor(cause?: unknown) {
    super("NOT_COUNTERPARTY", "Counterparty has no prior payment history with this entity", cause);
    this.name = "NotCounterpartyError";
  }
}

export class DisputeCooldownError extends FhoxError {
  constructor(cause?: unknown) {
    super("DISPUTE_COOLDOWN", "Per-counterparty dispute cooldown is still active", cause);
    this.name = "DisputeCooldownError";
  }
}

export class PrincipalMediatorCollisionError extends FhoxError {
  constructor(cause?: unknown) {
    super("PRINCIPAL_MEDIATOR_COLLISION", "Principal and mediator cannot be the same address", cause);
    this.name = "PrincipalMediatorCollisionError";
  }
}

export class ZeroAddressError extends FhoxError {
  constructor(cause?: unknown) {
    super("ZERO_ADDRESS", "Address argument cannot be the zero address", cause);
    this.name = "ZeroAddressError";
  }
}

const SELECTORS = new Map<string, (data: string) => FhoxError>([
  [sel("EmptyLegalName()"), () => new EmptyNameError()],
  [sel("NotPrincipal()"), () => new NotPrincipalError()],
  [sel("NotMediator()"), () => new NotMediatorError()],
  [sel("CounterpartyNotAllowed()"), () => new CounterpartyNotAllowedError()],
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

export function mapContractError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;

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

export { keccak256 };
