import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode } from "../output.js";

export function registerWatchCommand(program: Command) {
  program
    .command("watch <manager>")
    .description("tail PaymentExecuted + DisputeOpened + DisputeResolved events")
    .option("--from-block <n>", "start block (defaults to latest)", "")
    .option("--interval <seconds>", "polling interval in seconds", "5")
    .action(async (manager: string, opts: { fromBlock: string; interval: string }) => {
      try {
        const c = makeClient();
        const m = getAddress(manager);
        const intervalMs = Math.max(1, Number(opts.interval || "5")) * 1000;
        let cursor: bigint = opts.fromBlock
          ? BigInt(opts.fromBlock)
          : await c.publicClient.getBlockNumber();

        if (!isJsonMode()) {
          process.stderr.write(
            `${fmt.dim(`watching ${m} from block ${cursor} (Ctrl-C to stop)`)}\n`,
          );
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const head = await c.publicClient.getBlockNumber();
          if (head >= cursor) {
            const [payments, opened, resolved] = await Promise.all([
              c.getPayments(m, cursor, head),
              c.getDisputesOpened(m, cursor, head),
              c.getDisputesResolved(m, cursor, head),
            ]);

            for (const p of payments) {
              if (isJsonMode()) {
                emit({
                  event: "PaymentExecuted",
                  blockNumber: p.blockNumber.toString(),
                  txHash: p.txHash,
                  counterparty: p.counterparty,
                  amount: p.amount.toString(),
                  memoHash: p.memoHash,
                });
              } else {
                emit(
                  `${fmt.dim("block " + p.blockNumber)} ${fmt.green("PAY")}     ${formatUsdc(p.amount)} → ${p.counterparty}`,
                );
              }
            }
            for (const d of opened) {
              if (isJsonMode()) {
                emit({
                  event: "DisputeOpened",
                  blockNumber: d.blockNumber.toString(),
                  txHash: d.txHash,
                  disputeId: d.disputeId.toString(),
                  counterparty: d.counterparty,
                  reason: d.reason,
                });
              } else {
                emit(
                  `${fmt.dim("block " + d.blockNumber)} ${fmt.yellow("DISPUTE")} #${d.disputeId} ${d.counterparty} "${d.reason}"`,
                );
              }
            }
            for (const r of resolved) {
              if (isJsonMode()) {
                emit({
                  event: "DisputeResolved",
                  blockNumber: r.blockNumber.toString(),
                  txHash: r.txHash,
                  disputeId: r.disputeId.toString(),
                  counterparty: r.counterparty,
                  award: r.award.toString(),
                  evidenceHash: r.evidenceHash,
                });
              } else {
                emit(
                  `${fmt.dim("block " + r.blockNumber)} ${fmt.cyan("RESOLVE")} #${r.disputeId} award ${formatUsdc(r.award)} → ${r.counterparty}`,
                );
              }
            }
            cursor = head + 1n;
          }
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch (err) {
        emitError(err);
      }
    });
}
