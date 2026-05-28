import type { Command } from "commander";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode } from "../output.js";

export function registerFindCommand(program: Command) {
  program
    .command("find <legalName>")
    .description("resolve a legal name to its manager address")
    .action(async (legalName: string) => {
      try {
        const c = makeClient();
        const manager = await c.findEntityByName(legalName);
        if (isJsonMode()) {
          emit({ legalName, manager });
          return;
        }
        if (!manager) {
          emit(`${fmt.dim("not found")} — "${legalName}" is not registered`);
          process.exit(1);
        }
        emit(`${fmt.cyan(manager)}`);
      } catch (err) {
        emitError(err);
      }
    });
}
