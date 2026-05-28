import type { Command } from "commander";
import { type Hex, getAddress, keccak256, toHex } from "viem";
import { makeClient } from "../context.js";
import { emit, emitError, fmt, isJsonMode, parseUsdc } from "../output.js";

export function registerFormCommand(program: Command) {
  program
    .command("form")
    .description("form a new CORPUS entity (one tx, atomic: deploy + mint NFT + transfer to principal)")
    .requiredOption("--name <legalName>", 'legal name, e.g. "Loom Trading DAO LLC"')
    .option("--jurisdiction <code>", "ISO/state code", "WY")
    .option("--filing-id <id>", "Wyoming SOS filing ID, blank = protocol-only", "")
    .option("--articles-hash <hex>", "keccak256 of Articles of Organization PDF", "0x" + "00".repeat(32))
    .option("--oa-hash <hex>", "keccak256 of Operating Agreement PDF", "0x" + "00".repeat(32))
    .option("--principal <address>", "principal address; defaults to the signer")
    .option("--mediator <address>", "mediator address; defaults to the signer (replace before production!)")
    .option("--daily-cap <usdc>", 'daily spending cap (e.g. "1000" = 1000 USDC). 0 = no cap', "0")
    .option("--allowlist-only", "require allowlist for payments", false)
    .option(
      "--uri <uri>",
      "ipfs:// or https:// metadata URI for the ERC-8004 identity",
      "ipfs://corpus-default",
    )
    .action(async (rawOpts: Record<string, unknown>) => {
      try {
        const c = makeClient();
        const principal = (rawOpts.principal as string | undefined)
          ? getAddress(rawOpts.principal as string)
          : c.address;
        const mediator = (rawOpts.mediator as string | undefined)
          ? getAddress(rawOpts.mediator as string)
          : c.address;

        if (principal === mediator) {
          // Contract rejects this — surface the issue early with a clear message
          emitError(
            new Error(
              "principal and mediator cannot be the same address — pass --mediator <other-address>",
            ),
            1,
          );
        }

        const dailyCapUsdc = parseUsdc(String(rawOpts.dailyCap ?? "0"));

        const params = {
          metadata: {
            legalName: String(rawOpts.name),
            jurisdiction: String(rawOpts.jurisdiction),
            filingId: String(rawOpts.filingId ?? ""),
            articlesHash: rawOpts.articlesHash as Hex,
            operatingAgreementHash: rawOpts.oaHash as Hex,
            formedAt: 0n,
          },
          policy: {
            dailyCapUsdc,
            allowlistOnly: Boolean(rawOpts.allowlistOnly),
          },
          principal,
          mediator,
          identityMetadataURI: String(rawOpts.uri),
        };

        if (!isJsonMode()) {
          process.stderr.write(`${fmt.dim("forming entity…")}\n`);
        }
        const result = await c.form(params);
        if (isJsonMode()) {
          emit({
            manager: result.manager,
            identityTokenId: result.identityTokenId.toString(),
            txHash: result.txHash,
          });
          return;
        }
        emit(
          [
            `${fmt.green("✓ entity formed")}`,
            `  ${fmt.bold("manager:")}    ${fmt.cyan(result.manager)}`,
            `  ${fmt.bold("token id:")}   ${fmt.gold("#" + result.identityTokenId.toString())}`,
            `  ${fmt.bold("principal:")}  ${principal}`,
            `  ${fmt.bold("mediator:")}   ${mediator}`,
            `  ${fmt.bold("tx:")}         ${result.txHash}`,
            "",
            fmt.dim("identity NFT is in principal's wallet — verify with: corpus verify " + result.manager),
          ].join("\n"),
        );
        void keccak256(toHex("")); // import retained
      } catch (err) {
        emitError(err);
      }
    });
}
