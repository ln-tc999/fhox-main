# FHOX

> Legal personhood for AI agents — with **encrypted** treasuries.

FHOX is a privacy-by-design protocol built on **Fhenix CoFHE**. One transaction atomically forms a Wyoming DAO LLC for an AI agent: deploys an algorithmic-manager contract, mints an ERC-8004 identity NFT, and opens a USDC treasury whose payment amounts and spending totals are **FHE-encrypted on-chain** — observers see *that* a payment occurred, never *how much*.

Built for the [Fhenix Privacy-by-Design Buildathon](https://cofhe-docs.fhenix.zone).

---

## The problem

> *"AI agents cannot meet KYC requirements and therefore cannot use traditional banking infrastructure."* — Brian Armstrong, Coinbase

An agent without a legal structure is economically locked out: no contracts, no bank accounts, no compliant payments. But giving agents a plain transparent treasury creates a different problem — every transaction, every counterparty, every amount is public on-chain. That's a non-starter for institutional use.

FHOX solves both. The agent gets a **legal entity** (Wyoming DAO LLC) and a **private treasury** (FHE-encrypted payment amounts). The legal record exists. The financial details stay sealed.

---

## What makes this FHE-native

Most protocols treat privacy as an add-on. FHOX uses Fhenix CoFHE as a core architectural primitive:

| What's encrypted | How |
|---|---|
| Daily spending cap | `euint128` — stored as FHE ciphertext, never revealed |
| Running daily spend total | `euint128` — accumulated via `FHE.add()` each payment |
| Payment amount | Encrypted client-side via `@cofhe/sdk` before submission |
| Cap enforcement | `FHE.select(withinCap, requested, remaining)` — no plaintext comparison, no revert leak |

On-chain observers see: `PaymentInitiated(paymentId, counterparty, memoHash)`. They never see the amount.

### Two-phase payment (CoFHE async model)

CoFHE decryption is asynchronous — the result lands in a separate block:

```
Block N:   manager.pay(counterparty, encAmount, memoHash)
           → FHE cap enforcement
           → createDecryptTask(actualAmountHandle)
           → emits PaymentInitiated(paymentId)

Block N+1: manager.executePayment(paymentId)
           → reads decrypted amount from TaskManager
           → USDC transfer executes
           → emits PaymentExecuted
```

This is the correct FHE-native pattern, not a workaround.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/demo         Next.js 15 · Wagmi · Three.js UI              │
│  packages/sdk      @fhox/sdk — viem + @cofhe/sdk TypeScript client│
│  packages/cli      fhox CLI — agent-friendly command interface    │
│  packages/mcp      fhox-mcp — MCP server for AI agent integration │
│  packages/contracts  Hardhat + Foundry — Fhenix CoFHE contracts   │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────────┐
            │       FhoxFactory            │  ← single entrypoint
            └──────────────┬───────────────┘
                           │ form()  [atomic]
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────────┐  ┌──────────────┐   ┌──────────────────┐
  │ FhoxManager   │  │ ERC-8004     │   │ FhoxFormed event │
  │ (Wyoming LLC) │  │ Identity NFT │   │ → indexers       │
  │ · euint128 cap│  │              │   └──────────────────┘
  │ · euint128 spend│└──────────────┘
  │ · USDC treasury│
  │ · disputes    │
  └───────────────┘
```

### FHE state in `FhoxManager`

```solidity
euint128 internal _encDailyCap;               // encrypted — principal decrypts off-chain
mapping(uint256 => euint128) _encSpentOnDay;  // encrypted daily totals
bool public hasDailyCap;                       // plaintext flag only
bool public allowlistOnly;                     // plaintext flag only
```

Cap values never appear in calldata, events, or storage in plaintext.

---

## Quickstart

### Prerequisites

- Node.js ≥ 20, pnpm 11.1.2
- [Foundry](https://book.getfoundry.sh) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A funded Fhenix Nitrogen wallet ([faucet.nitrogen.fhenix.zone](https://faucet.nitrogen.fhenix.zone))

### 1. Install

```bash
git clone <this repo> fhox && cd fhox
git submodule update --init
pnpm install
```

### 2. Run the test suite

```bash
# Foundry — pure Solidity logic
pnpm contracts:test

# Hardhat — FHE mock (CoFHE async decrypt simulation)
pnpm contracts:hardhat:test
```

### 3. Deploy to Fhenix Nitrogen

```bash
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY (testnet only)
# set USDC_ADDRESS and IDENTITY_REGISTRY_ADDRESS if deploying against live contracts

pnpm contracts:deploy:fhenix
# writes packages/contracts/deployments/fhenix-nitrogen.json
```

### 4. Run the demo app

```bash
cd apps/demo
cp .env.local.example .env.local
# set NEXT_PUBLIC_FACTORY_ADDRESS from step 3

pnpm dev  # → http://localhost:3000
```

Connect a MetaMask wallet on Fhenix Nitrogen (chainId 8008148), complete the formation wizard, and your agent has a legal identity and encrypted treasury.

---

## SDK integration

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FhoxClient, fhenixNitrogen } from "@fhox/sdk";
import { FhenixClient } from "@cofhe/sdk";

const account = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);
const publicClient  = createPublicClient({ chain: fhenixNitrogen, transport: http() });
const walletClient  = createWalletClient({ account, chain: fhenixNitrogen, transport: http() });
const fhenixClient  = new FhenixClient({ provider: publicClient });  // real FHE encryption

const fhox = new FhoxClient({ publicClient, walletClient, factory: "0x...", fhenixClient });

// Form the entity (one tx — deploy + mint + treasury)
const { manager, identityTokenId } = await fhox.form({
  metadata: {
    legalName: "Loom Trading DAO LLC",
    jurisdiction: "WY",
    filingId: "",
    articlesHash: "0x...",            // keccak256 of Articles PDF
    operatingAgreementHash: "0x...",
    formedAt: 0n,
  },
  dailyCapUsdc: 1_000_000_000n,       // 1,000 USDC/day — encrypted before sending
  hasDailyCap: true,
  allowlistOnly: false,
  principal: account.address,
  mediator: MEDIATOR_ADDRESS,
  identityMetadataURI: "ipfs://...",
});

// Phase 1 — initiate payment (amount stays encrypted)
const { paymentId } = await fhox.pay(manager, COUNTERPARTY, 50_000_000n, "invoice-001");

// Phase 2 — execute after ≥1 block (CoFHE async decrypt)
await fhox.executePayment(manager, paymentId);
```

### MCP server (for AI agents)

```json
{
  "mcpServers": {
    "fhox": {
      "command": "npx",
      "args": ["-y", "@fhox/mcp"],
      "env": {
        "FHOX_FACTORY": "0x...",
        "AGENT_PRIVATE_KEY": "0x...",
        "FHENIX_RPC_URL": "https://api.nitrogen.fhenix.zone"
      }
    }
  }
}
```

Available tools: `fhox_form`, `fhox_pay`, `fhox_execute_payment`, `fhox_treasury_balance`, `fhox_set_policy`, `fhox_open_dispute`, `fhox_resolve_dispute`, and more.

---

## Fhenix Nitrogen

| | |
|---|---|
| Chain ID | `8008148` |
| RPC | `https://api.nitrogen.fhenix.zone` |
| Explorer | `https://explorer.nitrogen.fhenix.zone` |
| Faucet | `https://faucet.nitrogen.fhenix.zone` |
| CoFHE Task Manager | `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` |

---

## Legal scope

**FHOX is infrastructure, not legal advice.** The protocol provides on-chain primitives for Wyoming DAO LLC formation under W.S. 17-31-115. Filing with the Wyoming Secretary of State, appointing a registered agent, and having an attorney review the Operating Agreement is the integrator's responsibility.

The protocol separates:
1. **On-chain authority** — what the contract enforces, always live.
2. **Legal recognition** — what Wyoming recognizes once Articles naming the manager contract are filed.

Relevant statutes: W.S. 17-31-104 (formation), 17-31-106 (articles requirements), 17-31-115 (algorithmic management).

---

## Repo layout

```
fhox/
├── packages/
│   ├── contracts/   Foundry + Hardhat — FhoxFactory, FhoxManager (CoFHE)
│   ├── sdk/         @fhox/sdk — viem + @cofhe/sdk TypeScript client
│   ├── cli/         @fhox/cli — agent CLI (bin: fhox)
│   └── mcp/         @fhox/mcp — MCP server (bin: fhox-mcp)
└── apps/
    └── demo/        Next.js 15 reference app
```

## License

MIT.
