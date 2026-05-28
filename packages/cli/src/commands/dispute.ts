import type { Command } from "commander";
import { type Hex, getAddress, keccak256, toHex } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode, parseUsdc } from "../output.js";

export function registerDisputeCommand(program: Command) {
  const dispute = program.command("dispute").description("open or resolve disputes");

  dispute
    .command("open <manager> <counterparty> <amount> <reason>")
    .description("open a dispute (caller must be principal or the counterparty)")
    .action(async (manager: string, counterparty: string, amount: string, reason: string) => {
      try {
        const c = makeClient();
        const amt = parseUsdc(amount);
        const result = await c.openDispute(getAddress(manager), getAddress(counterparty), amt, reason);
        if (isJsonMode()) {
          emit({
            disputeId: result.disputeId.toString(),
            txHash: result.txHash,
            counterparty,
            amount: amt.toString(),
            reason,
          });
          return;
        }
        emit(
          [
            fmt.green("✓ dispute opened"),
            `  id:           ${fmt.gold("#" + result.disputeId.toString())}`,
            `  counterparty: ${fmt.cyan(counterparty)}`,
            `  amount:       ${formatUsdc(amt)}`,
            `  reason:       "${reason}"`,
            `  tx:           ${result.txHash}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });

  dispute
    .command("resolve <manager> <disputeId> <award> [evidenceHash]")
    .description("mediator-only: deliver a binding resolution")
    .action(async (manager: string, disputeId: string, award: string, evidenceHash?: string) => {
      try {
        const c = makeClient();
        const id = BigInt(disputeId);
        const awardAmt = parseUsdc(award);
        const hash = (evidenceHash ?? keccak256(toHex(""))) as Hex;
        const tx = await c.resolveDispute(getAddress(manager), id, awardAmt, hash);
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({
            txHash: tx.txHash,
            status: receipt.status,
            disputeId: id.toString(),
            award: awardAmt.toString(),
            evidenceHash: hash,
          });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ dispute resolved") : fmt.red("✗ reverted"),
            `  id:        #${id}`,
            `  award:     ${formatUsdc(awardAmt)}`,
            `  evidence:  ${hash}`,
            `  tx:        ${tx.txHash}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });

  dispute
    .command("get <manager> <disputeId>")
    .description("read a single dispute by id")
    .action(async (manager: string, disputeId: string) => {
      try {
        const c = makeClient();
        const d = await c.getDispute(getAddress(manager), BigInt(disputeId));
        if (isJsonMode()) {
          emit(
            d
              ? {
                  id: d.id.toString(),
                  counterparty: d.counterparty,
                  amountAtIssue: d.amountAtIssue.toString(),
                  status: d.status,
                  openedAt: d.openedAt.toString(),
                }
              : { id: disputeId, found: false },
          );
          if (!d) process.exit(1);
          return;
        }
        if (!d) {
          emit(fmt.dim(`no dispute #${disputeId}`));
          process.exit(1);
        }
        const statusName = ["None", "Open", "Resolved"][d.status] ?? "?";
        const opened = new Date(Number(d.openedAt) * 1000).toISOString();
        emit(
          [
            `${fmt.bold("dispute")} #${d.id}`,
            `  counterparty:    ${d.counterparty}`,
            `  amount at issue: ${formatUsdc(d.amountAtIssue)}`,
            `  status:          ${statusName}`,
            `  opened:          ${opened}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });
}
