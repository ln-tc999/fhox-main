# CORPUS

> Legal bodies for AI agents. Onchain.

CORPUS is the protocol layer that gives an autonomous agent a **legal identity** to transact with. One transaction on Arc deploys an algorithmic-manager smart contract structured as a Wyoming DAO LLC (W.S. 17-31-115), mints an ERC-8004 agent identity, and opens a USDC treasury with on-chain spending policies and binding dispute mediation.

Built for the [Agora Agents Hackathon](https://thecanteenapp.com) — Canteen × Circle × Arc.

---

## The gap CORPUS fills

| Layer                | Existing solution            |
| -------------------- | ---------------------------- |
| Legal formation      | OtoCo (web3 founders, no agents); Corpo (sandbox) |
| Onchain identity     | ERC-8004 (no legal wrapper)  |
| Treasury & payments  | Circle Agent Stack            |
| Job/escrow contracts | ERC-8183                      |
| **Legal personhood for autonomous agents that ties all of the above together** | **— CORPUS —** |

Coinbase's Brian Armstrong: *"AI agents cannot meet KYC requirements and therefore cannot use traditional banking infrastructure."* That's the moat. Agents without a legal structure are economically locked out. CORPUS is the unlock.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/demo            Next.js 15 reference integration            │
│  packages/sdk         @corpus/sdk — viem-based TypeScript client │
│  packages/contracts   Foundry · Solidity 0.8.28                  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────────┐
            │       CorpusFactory          │  ← single entrypoint
            └──────────────┬───────────────┘
                           │ form()
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────────┐  ┌──────────────┐   ┌──────────────────┐
  │ CorpusManager │  │ ERC-8004     │   │ CorpusFormed log │
  │ (the LLC)     │  │ Identity NFT │   │ → integrators &  │
  │ - treasury    │  │ (Arc 0x8004…)│   │   indexers       │
  │ - policy      │  └──────────────┘   └──────────────────┘
  │ - disputes    │
  └───────────────┘
```

### What the manager contract is

`CorpusManager` is the on-chain **algorithmic manager** under Wyoming W.S. 17-31-115. When the Articles of Organization name this contract address and the Operating Agreement references it, the contract's behavior is the legally operative authority of the LLC. Specifically:

- **`principal`** — the EOA / smart account that authorizes commercial actions.
- **`mediator`** — the address whose `resolveDispute` calls are binding under the OA.
- **`pay()`** — gated by the on-chain `SpendingPolicy` (daily cap + optional counterparty allowlist).
- **`openDispute()` / `resolveDispute()`** — the binding dispute mechanism the OA points to.

### Arc-native addresses

The factory wires up to Arc Testnet's canonical contracts at deploy time:

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| USDC (ERC-20 interface)     | `0x3600000000000000000000000000000000000000` |
| ERC-8004 IdentityRegistry   | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ERC-8004 ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

---

## Quickstart

### 1. Install

```bash
git clone <this repo> corpus && cd corpus
pnpm install
```

You'll also need:
- [Foundry](https://book.getfoundry.sh) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A funded Arc Testnet wallet ([faucet.circle.com](https://faucet.circle.com))

### 2. Run the contracts test suite

```bash
pnpm contracts:test
```

10 tests cover: formation, ERC-8004 identity mint, payment within cap, payment over cap, allowlist gate, principal-only enforcement, dispute open/resolve, mediator-only resolution, award bounds, principal rotation.

### 3. Deploy the factory to Arc Testnet

```bash
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY (testnet only — never reuse a mainnet key)

source .env
pnpm contracts:deploy:arc-testnet
```

The script writes `packages/contracts/deployments/arc-testnet.json` with the factory address.

### 4. Run the demo app

```bash
cd apps/demo
cp .env.local.example .env.local
# set NEXT_PUBLIC_FACTORY_ADDRESS to the address printed in step 3

pnpm dev
# → http://localhost:3000
```

Connect a wallet on Arc Testnet, fill in the wizard, and form an entity. The transaction will:
1. Mint an ERC-8004 identity NFT for the agent.
2. Deploy a `CorpusManager` initialized with your policy.
3. Emit `CorpusFormed(manager, principal, identityTokenId, ...)` — your indexable formation event.

---

## Integrating CORPUS into your agent

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CorpusClient, arcTestnet } from "@corpus/sdk";

const account = privateKeyToAccount(process.env.AGENT_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

const corpus = new CorpusClient({
  publicClient,
  walletClient,
  factory: "0x...",  // your deployed factory address
});

// Form the entity
const { manager, identityTokenId } = await corpus.form({
  metadata: {
    legalName: "Loom Trading DAO LLC",
    jurisdiction: "WY",
    filingId: "",                    // empty = protocol-only; integrator may file separately
    articlesHash: "0x...",           // keccak256 of your Articles PDF
    operatingAgreementHash: "0x...",
    formedAt: 0n,
  },
  policy: {
    dailyCapUsdc: 1_000_000_000n,    // 1,000 USDC/day (6 decimals)
    allowlistOnly: false,
  },
  principal: account.address,
  mediator: MEDIATOR_ADDRESS,
  identityMetadataURI: "ipfs://...",  // ERC-8004 metadata
});

// Spend from the treasury
await corpus.pay(manager, COUNTERPARTY, 5_000_000n, "invoice-2026-001");
```

---

## A note on legal scope

**CORPUS as deployed is infrastructure, not legal advice.** The protocol provides the on-chain primitives a Wyoming DAO LLC formation requires. Whether a given deployment is filed with the Wyoming Secretary of State, paired with a registered agent, and accompanied by a reviewed Operating Agreement is the integrator's responsibility. The demo app generates the on-chain artifacts and a draft metadata payload; it does not file with the state.

The protocol intentionally separates:

1. **On-chain authority** — what the contract enforces, always live.
2. **Legal recognition** — what Wyoming recognizes once the Articles are filed naming the manager contract.

For a fully recognized entity, see W.S. 17-31-104 (formation), W.S. 17-31-106 (articles requirements — note the mandatory "Notice of Restrictions on Duties and Transfers" clause), and W.S. 17-31-115 (algorithmic management).

---

## Repo layout

```
corpus/
├── packages/
│   ├── contracts/      Foundry workspace — Solidity contracts + tests
│   │   ├── src/
│   │   │   ├── CorpusFactory.sol
│   │   │   ├── CorpusManager.sol
│   │   │   ├── interfaces/
│   │   │   └── mocks/
│   │   ├── test/
│   │   ├── script/Deploy.s.sol
│   │   └── foundry.toml
│   └── sdk/            @corpus/sdk — viem-based TS client
│       └── src/
└── apps/
    └── demo/           Next.js 15 reference integration
        └── src/
```

## License

MIT.
