import type { Command } from "commander";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode } from "../output.js";

export function registerWhoamiCommand(program: Command) {
  program
    .command("whoami")
    .description("show the signer address, USDC balance, and factory it's pointed at")
    .action(async () => {
      try {
        const c = makeClient();
        const balance = await c.usdcBalanceOf(c.address);
        if (isJsonMode()) {
          emit({
            address: c.address,
            factory: c.factory,
            usdc: c.usdc,
            identityRegistry: c.identityRegistry,
            usdcBalance: balance.toString(),
          });
          return;
        }
        emit(
          [
            `${fmt.bold("signer:")}            ${fmt.cyan(c.address)}`,
            `${fmt.bold("factory:")}           ${c.factory}`,
            `${fmt.bold("usdc:")}              ${c.usdc}`,
            `${fmt.bold("identity registry:")} ${c.identityRegistry}`,
            `${fmt.bold("usdc balance:")}      ${fmt.gold(formatUsdc(balance))}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });
}
