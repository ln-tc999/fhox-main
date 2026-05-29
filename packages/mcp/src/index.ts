#!/usr/bin/env node
/**
 * FHOX MCP server.
 *
 * Exposes every FhoxClient method as an MCP tool so any LLM agent (Claude, GPT,
 * etc) connected via MCP can form LLCs, run privacy-first treasury operations,
 * verify entities, and open/resolve disputes — all on Arbitrum Sepolia.
 *
 * Transport: stdio. Drop into Claude Desktop / Cursor / any MCP-aware host.
 *
 * Env required:
 *   FHENIX_RPC_URL       - Arbitrum Sepolia JSON-RPC URL
 *   FHOX_FACTORY         - deployed FhoxFactory address
 *   AGENT_PRIVATE_KEY    - 0x-prefixed 64-char hex
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  FhoxClient,
  arbitrumSepolia,
  fhenixWalletClient,
} from "@fhox/sdk";
import { type Address, type Hex, createPublicClient, getAddress, http, keccak256, toHex } from "viem";
import { z } from "zod";

// ── Env / client ────────────────────────────────────────────────────────────

function loadClient(): FhoxClient {
  const rpcUrl = process.env.FHENIX_RPC_URL;
  const factory = process.env.FHOX_FACTORY;
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  const missing: string[] = [];
  if (!rpcUrl) missing.push("FHENIX_RPC_URL");
  if (!factory) missing.push("FHOX_FACTORY");
  if (!privateKey) missing.push("AGENT_PRIVATE_KEY");
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")}`);

  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  const walletClient = fhenixWalletClient({ rpcUrl: rpcUrl!, privateKey: privateKey as Hex });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new FhoxClient({ publicClient: publicClient as any, walletClient, factory: getAddress(factory!) });
}

// ── USDC helpers (6 decimals) ───────────────────────────────────────────────

function parseUsdc(s: string): bigint {
  const cleaned = s.replace(/[, _]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new Error(`invalid USDC amount: "${s}"`);
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > 6) throw new Error("USDC has 6 decimals max");
  return BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}
function formatUsdc(n: bigint): string {
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0")} USDC`;
}

// ── Stringify bigints for JSON responses ────────────────────────────────────

function ser(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(ser);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = ser(val);
    return out;
  }
  return v;
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(ser(payload), null, 2) }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "ERROR";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message, code }) }],
  };
}

// ── Tool schemas ────────────────────────────────────────────────────────────

const HexSchema = z.string().regex(/^0x[a-fA-F0-9]+$/);
const Bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const tools = [
  {
    name: "fhox_whoami",
    description: "Show this agent's signer address, USDC balance, and which factory it's pointed at.",
    inputSchema: { type: "object", properties: {} },
    schema: z.object({}),
    handler: async (_args: unknown) => {
      const c = loadClient();
      const balance = await c.usdcBalanceOf(c.address);
      return ok({
        address: c.address,
        factory: c.factory,
        usdc: c.usdc,
        identityRegistry: c.identityRegistry,
        usdcBalance: balance.toString(),
        usdcBalanceFormatted: formatUsdc(balance),
      });
    },
  },
  {
    name: "fhox_is_name_taken",
    description: "Check whether a legal entity name is already registered.",
    inputSchema: {
      type: "object",
      properties: { legalName: { type: "string", description: "Legal name to check" } },
      required: ["legalName"],
    },
    schema: z.object({ legalName: z.string() }),
    handler: async (args: { legalName: string }) => {
      const c = loadClient();
      return ok(await c.isNameTaken(args.legalName));
    },
  },
  {
    name: "fhox_find_entity_by_name",
    description: "Resolve a legal name to its manager address (null if not registered).",
    inputSchema: {
      type: "object",
      properties: { legalName: { type: "string" } },
      required: ["legalName"],
    },
    schema: z.object({ legalName: z.string() }),
    handler: async (args: { legalName: string }) => {
      const c = loadClient();
      return ok({ legalName: args.legalName, manager: await c.findEntityByName(args.legalName) });
    },
  },
  {
    name: "fhox_form",
    description:
      "Form a new FHOX entity. Atomically: deploys a FhoxManager with FHE-encrypted treasury, mints an ERC-8004 identity NFT, and transfers it to the principal. Returns manager address + token id.",
    inputSchema: {
      type: "object",
      properties: {
        legalName: { type: "string" },
        jurisdiction: { type: "string", default: "WY" },
        filingId: { type: "string", default: "" },
        principal: { type: "string", description: "Defaults to signer address" },
        mediator: { type: "string", description: "Must differ from principal" },
        dailyCapUsdc: { type: "string", description: "Daily cap as decimal USDC ('100', '0' = none)" },
        allowlistOnly: { type: "boolean", default: false },
        identityMetadataURI: { type: "string", default: "ipfs://fhox-default" },
        articlesHash: { type: "string", default: "0x" + "00".repeat(32) },
        operatingAgreementHash: { type: "string", default: "0x" + "00".repeat(32) },
      },
      required: ["legalName", "mediator"],
    },
    schema: z.object({
      legalName: z.string(),
      jurisdiction: z.string().default("WY"),
      filingId: z.string().default(""),
      principal: AddressSchema.optional(),
      mediator: AddressSchema,
      dailyCapUsdc: z.string().default("0"),
      allowlistOnly: z.boolean().default(false),
      identityMetadataURI: z.string().default("ipfs://fhox-default"),
      articlesHash: Bytes32Schema.default("0x" + "00".repeat(32)),
      operatingAgreementHash: Bytes32Schema.default("0x" + "00".repeat(32)),
    }),
    handler: async (args: z.infer<typeof formSchema>) => {
      const c = loadClient();
      const principal = args.principal ? getAddress(args.principal) : c.address;
      const dailyCapUsdc = parseUsdc(args.dailyCapUsdc);
      const hasDailyCap = Boolean(args.dailyCapUsdc) && dailyCapUsdc > 0n;
      const result = await c.form({
        metadata: {
          legalName: args.legalName,
          jurisdiction: args.jurisdiction,
          filingId: args.filingId,
          articlesHash: args.articlesHash as Hex,
          operatingAgreementHash: args.operatingAgreementHash as Hex,
          formedAt: 0n,
        },
        dailyCapUsdc,
        hasDailyCap,
        allowlistOnly: args.allowlistOnly,
        principal,
        mediator: getAddress(args.mediator),
        identityMetadataURI: args.identityMetadataURI,
      });
      return ok({
        manager: result.manager,
        identityTokenId: result.identityTokenId.toString(),
        txHash: result.txHash,
        principal,
        mediator: getAddress(args.mediator),
      });
    },
  },
  {
    name: "fhox_get_entity_state",
    description: "Read the full on-chain state of an entity (metadata, policy, actors, treasury).",
    inputSchema: {
      type: "object",
      properties: { manager: { type: "string" } },
      required: ["manager"],
    },
    schema: z.object({ manager: AddressSchema }),
    handler: async (args: { manager: string }) => {
      const c = loadClient();
      const state = await c.getEntityState(getAddress(args.manager) as Address);
      return ok({
        ...state,
        treasuryBalanceFormatted: formatUsdc(state.treasuryBalance),
        hasDailyCap: state.policy.hasDailyCap,
        allowlistOnly: state.policy.allowlistOnly,
      });
    },
  },
  {
    name: "fhox_verify_entity",
    description:
      "Cryptographically verify an entity. Checks that the on-chain principal owns the ERC-8004 identity NFT — proving the agent/LLC link is intact.",
    inputSchema: {
      type: "object",
      properties: { manager: { type: "string" } },
      required: ["manager"],
    },
    schema: z.object({ manager: AddressSchema }),
    handler: async (args: { manager: string }) => {
      const c = loadClient();
      return ok(await c.verifyEntity(getAddress(args.manager) as Address));
    },
  },
  {
    name: "fhox_treasury_balance",
    description: "Read an entity's USDC treasury balance.",
    inputSchema: {
      type: "object",
      properties: { manager: { type: "string" } },
      required: ["manager"],
    },
    schema: z.object({ manager: AddressSchema }),
    handler: async (args: { manager: string }) => {
      const c = loadClient();
      const balance = await c.treasuryBalance(getAddress(args.manager) as Address);
      return ok({ balance: balance.toString(), formatted: formatUsdc(balance) });
    },
  },
  {
    name: "fhox_fund",
    description: "Send USDC from the signer's wallet to a manager (or any address).",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        amount: { type: "string", description: "Decimal USDC, e.g. '100'" },
      },
      required: ["to", "amount"],
    },
    schema: z.object({ to: AddressSchema, amount: z.string() }),
    handler: async (args: { to: string; amount: string }) => {
      const c = loadClient();
      const tx = await c.fund(getAddress(args.to) as Address, parseUsdc(args.amount));
      const receipt = await tx.wait();
      return ok({ txHash: tx.txHash, blockNumber: receipt.blockNumber.toString(), status: receipt.status });
    },
  },
  {
    name: "fhox_pay",
    description: "Execute a USDC payment from an entity's treasury under its spending policy.",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string" },
        counterparty: { type: "string" },
        amount: { type: "string", description: "Decimal USDC" },
        memo: { type: "string", description: "Free-text memo, will be keccak256-hashed on-chain" },
      },
      required: ["manager", "counterparty", "amount"],
    },
    schema: z.object({
      manager: AddressSchema,
      counterparty: AddressSchema,
      amount: z.string(),
      memo: z.string().default(""),
    }),
    handler: async (args: { manager: string; counterparty: string; amount: string; memo: string }) => {
      const c = loadClient();
      const { paymentId, txHash } = await c.pay(
        getAddress(args.manager) as Address,
        getAddress(args.counterparty) as Address,
        parseUsdc(args.amount),
        args.memo,
      );
      const receipt = await c.publicClient.waitForTransactionReceipt({ hash: txHash });
      return ok({
        paymentId: paymentId.toString(),
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        status: receipt.status,
        memoHash: keccak256(toHex(args.memo)),
      });
    },
  },
  {
    name: "fhox_set_allowlist",
    description: "Add or remove an address from the entity's allowlist.",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string" },
        address: { type: "string" },
        allowed: { type: "boolean" },
      },
      required: ["manager", "address", "allowed"],
    },
    schema: z.object({ manager: AddressSchema, address: AddressSchema, allowed: z.boolean() }),
    handler: async (args: { manager: string; address: string; allowed: boolean }) => {
      const c = loadClient();
      const tx = await c.setAllowlist(
        getAddress(args.manager) as Address,
        getAddress(args.address) as Address,
        args.allowed,
      );
      const r = await tx.wait();
      return ok({ txHash: tx.txHash, status: r.status });
    },
  },
  {
    name: "fhox_set_policy",
    description: "Update spending policy (daily cap + allowlist-only).",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string" },
        dailyCapUsdc: { type: "string" },
        allowlistOnly: { type: "boolean" },
      },
      required: ["manager", "dailyCapUsdc", "allowlistOnly"],
    },
    schema: z.object({
      manager: AddressSchema,
      dailyCapUsdc: z.string(),
      allowlistOnly: z.boolean(),
    }),
    handler: async (args: { manager: string; dailyCapUsdc: string; allowlistOnly: boolean }) => {
      const c = loadClient();
      const dailyCapUsdc = parseUsdc(args.dailyCapUsdc);
      const hasCap = dailyCapUsdc > 0n;
      const tx = await c.setPolicy(getAddress(args.manager) as Address, dailyCapUsdc, hasCap, args.allowlistOnly);
      const r = await tx.wait();
      return ok({ txHash: tx.txHash, status: r.status });
    },
  },
  {
    name: "fhox_rotate_principal",
    description: "Transfer commercial control of an entity to a new address.",
    inputSchema: {
      type: "object",
      properties: { manager: { type: "string" }, next: { type: "string" } },
      required: ["manager", "next"],
    },
    schema: z.object({ manager: AddressSchema, next: AddressSchema }),
    handler: async (args: { manager: string; next: string }) => {
      const c = loadClient();
      const tx = await c.rotatePrincipal(getAddress(args.manager) as Address, getAddress(args.next) as Address);
      const r = await tx.wait();
      return ok({ txHash: tx.txHash, status: r.status });
    },
  },
  {
    name: "fhox_rotate_mediator",
    description: "Swap the dispute-resolution mediator.",
    inputSchema: {
      type: "object",
      properties: { manager: { type: "string" }, next: { type: "string" } },
      required: ["manager", "next"],
    },
    schema: z.object({ manager: AddressSchema, next: AddressSchema }),
    handler: async (args: { manager: string; next: string }) => {
      const c = loadClient();
      const tx = await c.rotateMediator(getAddress(args.manager) as Address, getAddress(args.next) as Address);
      const r = await tx.wait();
      return ok({ txHash: tx.txHash, status: r.status });
    },
  },
  {
    name: "fhox_open_dispute",
    description:
      "Open a dispute against an entity. Caller must be the principal or the counterparty (who must have prior payment history).",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string" },
        counterparty: { type: "string" },
        amountClaimed: { type: "string" },
        reason: { type: "string" },
      },
      required: ["manager", "counterparty", "amountClaimed", "reason"],
    },
    schema: z.object({
      manager: AddressSchema,
      counterparty: AddressSchema,
      amountClaimed: z.string(),
      reason: z.string(),
    }),
    handler: async (args: {
      manager: string;
      counterparty: string;
      amountClaimed: string;
      reason: string;
    }) => {
      const c = loadClient();
      const r = await c.openDispute(
        getAddress(args.manager) as Address,
        getAddress(args.counterparty) as Address,
        parseUsdc(args.amountClaimed),
        args.reason,
      );
      return ok({ disputeId: r.disputeId.toString(), txHash: r.txHash });
    },
  },
  {
    name: "fhox_resolve_dispute",
    description: "Mediator-only: deliver a binding resolution. Pays the award out of the entity's treasury.",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string" },
        disputeId: { type: "string" },
        award: { type: "string", description: "Decimal USDC" },
        evidenceHash: { type: "string", description: "0x-prefixed bytes32 of evidence document" },
      },
      required: ["manager", "disputeId", "award"],
    },
    schema: z.object({
      manager: AddressSchema,
      disputeId: z.string(),
      award: z.string(),
      evidenceHash: Bytes32Schema.optional(),
    }),
    handler: async (args: { manager: string; disputeId: string; award: string; evidenceHash?: string }) => {
      const c = loadClient();
      const evHash = (args.evidenceHash ?? keccak256(toHex(""))) as Hex;
      const tx = await c.resolveDispute(
        getAddress(args.manager) as Address,
        BigInt(args.disputeId),
        parseUsdc(args.award),
        evHash,
      );
      const r = await tx.wait();
      return ok({ txHash: tx.txHash, status: r.status });
    },
  },
];

// Used by zod inference above
const formSchema = z.object({
  legalName: z.string(),
  jurisdiction: z.string().default("WY"),
  filingId: z.string().default(""),
  principal: AddressSchema.optional(),
  mediator: AddressSchema,
  dailyCapUsdc: z.string().default("0"),
  allowlistOnly: z.boolean().default(false),
  identityMetadataURI: z.string().default("ipfs://fhox-default"),
  articlesHash: Bytes32Schema.default("0x" + "00".repeat(32)),
  operatingAgreementHash: Bytes32Schema.default("0x" + "00".repeat(32)),
});
void HexSchema;

// ── Wire up MCP server ──────────────────────────────────────────────────────

const server = new Server(
  { name: "fhox-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) return fail(new Error(`unknown tool: ${req.params.name}`));
  try {
    const parsed = tool.schema.parse(req.params.arguments ?? {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (tool.handler as any)(parsed);
  } catch (err) {
    return fail(err);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is reserved for the MCP wire protocol
  process.stderr.write("[fhox-mcp] connected on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[fhox-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
