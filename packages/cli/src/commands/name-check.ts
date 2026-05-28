import type { Command } from "commander";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode } from "../output.js";

export function registerNameCheckCommand(program: Command) {
  program
    .command("name-check <legalName>")
    .description("check whether a legal name is already registered on the factory")
    .action(async (legalName: string) => {
      try {
        const c = makeClient();
        const { taken, existingManager } = await c.isNameTaken(legalName);
        if (isJsonMode()) {
          emit({ legalName, taken, existingManager });
          return;
        }
        if (taken) {
          emit(`${fmt.yellow("taken")} — "${legalName}" → ${fmt.cyan(existingManager)}`);
        } else {
          emit(`${fmt.green("available")} — "${legalName}" is not registered`);
        }
      } catch (err) {
        emitError(err);
      }
    });
}
