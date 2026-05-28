import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode } from "../output.js";

export function registerAllowlistCommand(program: Command) {
  program
    .command("allowlist <manager> <address>")
    .description("add or remove an address from the entity's allowlist (--remove to revoke)")
    .option("--remove", "remove instead of add", false)
    .action(async (manager: string, address: string, opts: { remove: boolean }) => {
      try {
        const c = makeClient();
        const tx = await c.setAllowlist(getAddress(manager), getAddress(address), !opts.remove);
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({
            txHash: tx.txHash,
            blockNumber: receipt.blockNumber.toString(),
            status: receipt.status,
            address,
            allowed: !opts.remove,
          });
          return;
        }
        emit(
          [
            receipt.status === "success"
              ? fmt.green(opts.remove ? "✓ removed from allowlist" : "✓ added to allowlist")
              : fmt.red("✗ reverted"),
            `  address:   ${fmt.cyan(address)}`,
            `  tx:        ${tx.txHash}`,
          ].join("\n"),
        );
        if (receipt.status !== "success") process.exit(2);
      } catch (err) {
        emitError(err);
      }
    });
}
