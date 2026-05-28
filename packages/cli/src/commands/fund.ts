import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode, parseUsdc } from "../output.js";

export function registerFundCommand(program: Command) {
  program
    .command("fund <to> <amount>")
    .description("send USDC from the signer's wallet to a manager (or any address)")
    .action(async (to: string, amount: string) => {
      try {
        const c = makeClient();
        const value = parseUsdc(amount);
        if (!isJsonMode()) {
          process.stderr.write(
            `${fmt.dim(`sending ${formatUsdc(value)} from ${c.address} → ${to}…`)}\n`,
          );
        }
        const tx = await c.fund(getAddress(to), value);
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({
            txHash: tx.txHash,
            blockNumber: receipt.blockNumber.toString(),
            status: receipt.status,
            amount: value.toString(),
            to,
          });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ funded") : fmt.red("✗ reverted"),
            `  amount:    ${fmt.gold(formatUsdc(value))}`,
            `  to:        ${fmt.cyan(to)}`,
            `  tx:        ${tx.txHash}`,
            `  block:     ${receipt.blockNumber}`,
          ].join("\n"),
        );
        if (receipt.status !== "success") process.exit(2);
      } catch (err) {
        emitError(err);
      }
    });
}
