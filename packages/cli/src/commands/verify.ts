import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode } from "../output.js";

export function registerVerifyCommand(program: Command) {
  program
    .command("verify <manager>")
    .description("cryptographically verify the entity (NFT owner == on-chain principal)")
    .action(async (manager: string) => {
      try {
        const c = makeClient();
        const result = await c.verifyEntity(getAddress(manager));
        if (isJsonMode()) {
          emit({
            verified: result.verified,
            reason: result.reason ?? null,
            manager: result.manager,
            identityTokenId: result.identityTokenId.toString(),
            expectedOwner: result.expectedOwner,
            actualOwner: result.actualOwner,
          });
          if (!result.verified) process.exit(1);
          return;
        }
        if (result.verified) {
          emit(
            [
              `${fmt.green("✓ verified")}`,
              `  manager:         ${fmt.cyan(result.manager)}`,
              `  identity #${result.identityTokenId}`,
              `  owned by:        ${fmt.cyan(result.actualOwner)}`,
              `  matches principal — entity is legitimate`,
            ].join("\n"),
          );
        } else {
          emit(
            [
              `${fmt.red("✗ verification failed")}`,
              `  manager:         ${fmt.cyan(result.manager)}`,
              `  identity #${result.identityTokenId}`,
              `  expected owner:  ${result.expectedOwner}`,
              `  actual owner:    ${fmt.red(result.actualOwner)}`,
              `  reason: ${result.reason}`,
            ].join("\n"),
          );
          process.exit(1);
        }
      } catch (err) {
        emitError(err);
      }
    });
}
