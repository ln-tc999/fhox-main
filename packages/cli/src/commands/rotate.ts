import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode } from "../output.js";

export function registerRotateCommand(program: Command) {
  const rotate = program.command("rotate").description("rotate principal or mediator");

  rotate
    .command("principal <manager> <next>")
    .description("transfer commercial control to a new address")
    .action(async (manager: string, next: string) => {
      try {
        const c = makeClient();
        const tx = await c.rotatePrincipal(getAddress(manager), getAddress(next));
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({ txHash: tx.txHash, status: receipt.status, next });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ principal rotated") : fmt.red("✗ reverted"),
            `  new principal: ${fmt.cyan(next)}`,
            `  tx:            ${tx.txHash}`,
            "",
            fmt.dim("note: the identity NFT does NOT automatically follow — transfer separately if desired"),
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });

  rotate
    .command("mediator <manager> <next>")
    .description("swap the dispute-resolution mediator")
    .action(async (manager: string, next: string) => {
      try {
        const c = makeClient();
        const tx = await c.rotateMediator(getAddress(manager), getAddress(next));
        const receipt = await tx.wait();
        if (isJsonMode()) {
          emit({ txHash: tx.txHash, status: receipt.status, next });
          return;
        }
        emit(
          [
            receipt.status === "success" ? fmt.green("✓ mediator rotated") : fmt.red("✗ reverted"),
            `  new mediator:  ${fmt.cyan(next)}`,
            `  tx:            ${tx.txHash}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });
}
