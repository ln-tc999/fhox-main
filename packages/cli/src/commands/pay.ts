import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode, parseUsdc } from "../output.js";

export function registerPayCommand(program: Command) {
  program
    .command("pay <manager> <to> <amount>")
    .description("execute a USDC payment from an entity's treasury")
    .option("--memo <text>", "memo (will be hashed on-chain)", "")
    .action(async (manager: string, to: string, amount: string, opts: { memo: string }) => {
      try {
        const c = makeClient();
        const value = parseUsdc(amount);
        if (!isJsonMode()) {
          process.stderr.write(
            `${fmt.dim(`paying ${formatUsdc(value)} from ${manager} → ${to}…`)}\n`,
          );
        }
        const tx = await c.pay(getAddress(manager), getAddress(to), value, opts.memo);
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({
            txHash: tx.txHash,
            blockNumber: receipt.blockNumber.toString(),
            status: receipt.status,
            amount: value.toString(),
            to,
            memo: opts.memo,
          });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ payment executed") : fmt.red("✗ reverted"),
            `  amount:    ${fmt.gold(formatUsdc(value))}`,
            `  to:        ${fmt.cyan(to)}`,
            opts.memo ? `  memo:      "${opts.memo}"` : "",
            `  tx:        ${tx.txHash}`,
            `  block:     ${receipt.blockNumber}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        if (receipt.status !== "success") process.exit(2);
      } catch (err) {
        emitError(err);
      }
    });
}
