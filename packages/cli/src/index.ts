#!/usr/bin/env node
import { Command } from "commander";
import { registerFormCommand } from "./commands/form.js";
import { registerNameCheckCommand } from "./commands/name-check.js";
import { registerStateCommand } from "./commands/state.js";
import { registerVerifyCommand } from "./commands/verify.js";
import { registerPayCommand } from "./commands/pay.js";
import { registerFundCommand } from "./commands/fund.js";
import { registerAllowlistCommand } from "./commands/allowlist.js";
import { registerPolicyCommand } from "./commands/policy.js";
import { registerRotateCommand } from "./commands/rotate.js";
import { registerDisputeCommand } from "./commands/dispute.js";
import { registerWatchCommand } from "./commands/watch.js";
import { registerFindCommand } from "./commands/find.js";
import { registerWhoamiCommand } from "./commands/whoami.js";
import { setJsonMode } from "./output.js";

const program = new Command();

program
  .name("corpus")
  .description("CORPUS CLI — onchain legal personhood for AI agents")
  .version("0.1.0")
  .option("--json", "emit machine-readable JSON instead of human-readable output")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts<{ json?: boolean }>();
    if (opts.json) setJsonMode(true);
  });

registerWhoamiCommand(program);
registerNameCheckCommand(program);
registerFindCommand(program);
registerFormCommand(program);
registerStateCommand(program);
registerVerifyCommand(program);
registerFundCommand(program);
registerPayCommand(program);
registerAllowlistCommand(program);
registerPolicyCommand(program);
registerRotateCommand(program);
registerDisputeCommand(program);
registerWatchCommand(program);

program.parseAsync(process.argv).catch((err) => {
  // commander prints its own errors for parse failures; only catch unhandled
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
