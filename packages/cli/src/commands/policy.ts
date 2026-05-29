import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode, parseUsdc } from "../output.js";

export function registerPolicyCommand(program: Command) {
  program
    .command("policy <manager>")
    .description("update spending policy (daily cap + allowlist-only)")
    .requiredOption("--cap <usdc>", 'daily cap in USDC, "0" for none')
    .option("--allowlist-only", "require allowlist", false)
    .option("--no-allowlist-only", "do NOT require allowlist")
    .action(async (manager: string, opts: { cap: string; allowlistOnly: boolean }) => {
      try {
        const c = makeClient();
        const dailyCapUsdc = parseUsdc(opts.cap);
        const hasCap = dailyCapUsdc > 0n;
        const tx = await c.setPolicy(getAddress(manager), dailyCapUsdc, hasCap, opts.allowlistOnly);
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({
            txHash: tx.txHash,
            status: receipt.status,
            dailyCapUsdc: dailyCapUsdc.toString(),
            allowlistOnly: opts.allowlistOnly,
          });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ policy updated") : fmt.red("✗ reverted"),
            `  daily cap:       ${opts.cap === "0" ? fmt.dim("none") : opts.cap + " USDC"}`,
            `  allowlist only:  ${opts.allowlistOnly ? fmt.yellow("yes") : fmt.dim("no")}`,
            `  tx:              ${tx.txHash}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });
}
