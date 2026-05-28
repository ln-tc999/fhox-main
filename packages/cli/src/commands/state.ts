import type { Command } from "commander";
import { getAddress } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, formatUsdc, isJsonMode } from "../output.js";

export function registerStateCommand(program: Command) {
  program
    .command("state <manager>")
    .description("read the full on-chain state of an entity")
    .action(async (manager: string) => {
      try {
        const c = makeClient();
        const s = await c.getEntityState(getAddress(manager));
        if (isJsonMode()) {
          emit({
            ...s,
            identityTokenId: s.identityTokenId.toString(),
            treasuryBalance: s.treasuryBalance.toString(),
            todaySpent: s.todaySpent.toString(),
            nextDisputeId: s.nextDisputeId.toString(),
            metadata: {
              ...s.metadata,
              formedAt: s.metadata.formedAt.toString(),
            },
            policy: {
              dailyCapUsdc: s.policy.dailyCapUsdc.toString(),
              allowlistOnly: s.policy.allowlistOnly,
            },
          });
          return;
        }
        const formed = new Date(Number(s.metadata.formedAt) * 1000).toISOString();
        emit(
          [
            fmt.gold("━━━ CORPUS Entity ━━━"),
            `${fmt.bold("manager:")}      ${fmt.cyan(s.manager)}`,
            "",
            fmt.bold("metadata"),
            `  legal name:    ${s.metadata.legalName}`,
            `  jurisdiction:  ${s.metadata.jurisdiction}`,
            `  filing id:     ${s.metadata.filingId || fmt.dim("(protocol-only)")}`,
            `  articles:      ${s.metadata.articlesHash}`,
            `  op. agreement: ${s.metadata.operatingAgreementHash}`,
            `  formed:        ${formed}`,
            `  identity #:    ${fmt.gold("#" + s.identityTokenId.toString())}`,
            "",
            fmt.bold("actors"),
            `  principal:     ${s.principal}`,
            `  mediator:      ${s.mediator}`,
            "",
            fmt.bold("treasury"),
            `  balance:       ${fmt.gold(formatUsdc(s.treasuryBalance))}`,
            `  today spent:   ${formatUsdc(s.todaySpent)}`,
            "",
            fmt.bold("policy"),
            `  daily cap:     ${s.policy.dailyCapUsdc === 0n ? fmt.dim("(none)") : formatUsdc(s.policy.dailyCapUsdc)}`,
            `  allowlist:     ${s.policy.allowlistOnly ? fmt.yellow("required") : fmt.dim("open")}`,
            "",
            fmt.bold("disputes"),
            `  next id:       ${s.nextDisputeId}`,
          ].join("\n"),
        );
      } catch (err) {
        emitError(err);
      }
    });
}
