# FHOX — agent guide

Privacy-first Wyoming DAO LLC formation for AI agents on Fhenix CoFHE. Payment amounts and spending caps are FHE-encrypted — observers see *that* a payment occurred, never *how much*.

## Commands

```bash
pnpm build                    # pnpm -r build (all packages)
pnpm test                     # pnpm -r test (all stubs — no tests exist yet)
pnpm dev                      # Next.js demo on :3000

pnpm contracts:build          # forge build (Foundry — pure Solidity)
pnpm contracts:test           # forge test -vv (Foundry)
pnpm contracts:fmt            # forge fmt (Solidity formatter)
pnpm contracts:hardhat:build  # npx hardhat compile (FHE mock)
pnpm contracts:hardhat:test   # npx hardhat test (FHE mock)
pnpm contracts:deploy:arbitrum-sepolia  # deploy to Arbitrum Sepolia testnet
pnpm contracts:deploy:local   # deploy to localhost hardhat node
```

**No tests exist yet** — all package `test` scripts are stubs (`echo "no sdk tests yet" && exit 0`). Test directories `packages/contracts/test/` and `test-hardhat/` are absent. Any new test must create them.

**pnpm install gotcha**: `pnpm-workspace.yaml` has `allowBuilds` with placeholder values for `@fhenixprotocol/cofhe-contracts` and `secp256k1`. Set both to `true` before running `pnpm install`.

`pnpm dev` runs only the demo app (not a watch build of all packages).

## Architecture

pnpm monorepo (`pnpm-workspace.yaml`):

```
packages/contracts/   Foundry + Hardhat — FhoxFactory + FhoxManager
packages/sdk/         @fhox/sdk — viem + @cofhe/sdk TS client (hand-maintained ABI)
packages/cli/         @fhox/cli — Commander CLI (bin: fhox)
packages/mcp/         @fhox/mcp — MCP server, stdio transport (bin: fhox-mcp)
apps/demo/            Next.js 15 + Wagmi demo
```

### Two contract build systems

- **Foundry** (`foundry.toml`): pure Solidity, no FHE mock. Sources in `src/`, tests in `test/`, artifacts in `out/`.
- **Hardhat** (`hardhat.config.ts`): FHE mock via `@cofhe/hardhat-plugin`. Sources in `src/`, tests in `test-hardhat/`, artifacts in `artifacts/`, cache in `cache-hardhat/`.

Both must pass. Foundry tests scope: factory logic, name dedup, access control — anything without FHE. Hardhat tests scope: FHE payment flow, `FHE.select()` cap enforcement, two-phase payment cycle.

### Two-phase payment (CoFHE async decrypt model)

1. `pay()` — FHE cap enforcement via `FHE.select()`, then `createDecryptTask`
2. `executePayment()` — reads `FHE.getDecryptResult()` and transfers USDC (≥1 block later)

Must wait ≥1 block between phases. In Hardhat tests, use `evm_increaseTime` for the decrypt result. Cap enforcement never reverts — it silently caps at remaining budget via `FHE.select()`.

### FHE state in FhoxManager

```solidity
euint128 _encDailyCap;                    // encrypted — never on-chain in plaintext
mapping(uint256 => euint128) _encSpentOnDay;
bool public hasDailyCap;                   // plaintext flag only
bool public allowlistOnly;                 // plaintext flag only
```

### SDK quirks

- ABI in `packages/sdk/src/abis.ts` is **hand-maintained** (not auto-generated from artifacts). Any contract change must update this manually.
- `getSealedDailyCap()` and `getSealedTodaySpent()` are `nonpayable` (they write ACL state via `FHE.allowSender()`), not `view`.
- Without `fhenixClient`, `_encryptUint128()` falls back to trivial encoding (ctHash=value, utype=6) — used for Hardhat mock testing.
- `form()` gas default: `5_000_000n`.

### React StrictMode disabled

`apps/demo/next.config.ts` disables StrictMode — Three.js WebGL context exhaustion on double-mounts.

## Env setup

| Variable | Purpose |
|---|---|
| `FHENIX_RPC_URL` | Arbitrum Sepolia RPC |
| `DEPLOYER_PRIVATE_KEY` | Deployer wallet (testnet only) |
| `FHOX_FACTORY` | Factory address (populated after deploy) |
| `AGENT_PRIVATE_KEY` | For CLI/MCP usage |
| `NEXT_PUBLIC_FHOX_FACTORY` | Same, for demo app |

CLI and MCP require `FHENIX_RPC_URL` + `FHOX_FACTORY` + `AGENT_PRIVATE_KEY` at minimum.

## Deployment

### Local (Hardhat node)

```bash
cd packages/contracts
npx hardhat node
# in another terminal:
export $(grep -v '^#' ../../.env | xargs) && npx hardhat run scripts/deploy.ts --network localhost
```

### Arbitrum Sepolia (testnet)

```bash
export $(grep -v '^#' ../../.env | xargs) && npx hardhat run scripts/deploy.ts --network arbSepolia
```

The `@cofhe/hardhat-plugin` automatically configures `arbSepolia` (chainId 421614, RPC `https://sepolia-rollup.arbitrum.io/rpc`) and `ethSepolia` (chainId 11155111, RPC `https://ethereum-sepolia.publicnode.com`).

### Current Arbitrum Sepolia deployment (2026-05-29)

| Contract | Address |
|---|---|
| MockUSDC | `0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D` |
| MockIdentityRegistry | `0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185` |
| FhoxFactory | `0xEAfd45D5E7ECCF6014D91D9e3da39134C347f3A9` |

File: `packages/contracts/deployments/arbitrum-sepolia.json`

## Key patterns

- **Atomic formation**: `FhoxFactory.form()` deploys `FhoxManager` + mints ERC-8004 NFT + transfers to principal in one tx.
- **Name dedup**: case-insensitive, whitespace-normalized via `_nameKey()`. "Loom Trading LLC", "loom  trading llc" all collide.
- **Sealed reads**: `getSealedDailyCap()` / `getSealedTodaySpent()` — principal only. Decrypt via `@cofhe/sdk` `FhenixClient.unseal()`.
- **Constructor + initialize**: `FhoxManager` uses two-step creation (constructor set immutable, `initialize()` set mutable state). Only callable by factory.
- **CoFHE Task Manager**: `0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9` — same address on all CoFHE-supported networks (Arbitrum Sepolia, Ethereum Sepolia, Base Sepolia).
- **`inEuint128` struct**: 4 fields — `ctHash` (uint256), `securityZone` (uint8), `utype` (uint8), `signature` (bytes).
- **Submodule**: `git submodule update --init` after clone (OpenZeppelin contracts).

## Stale files already present

- `docs/architecture.md` — references CORPUS/Arc (the predecessor), not FHOX/Fhenix. Do not trust.
- `KNOWLEDGE.md` — same, stale CORPUS-era doc.
- `CONTEXT.md` — Fhenix buildathon context, not repo documentation.
- `packages/contracts/deployments/arc-testnet.json` — CORPUS-era Arc Testnet addresses, not FHOX/Fhenix.
- `apps/demo/.env.local.example` — references old `NEXT_PUBLIC_ARC_RPC_URL` / `NEXT_PUBLIC_FACTORY_ADDRESS`; actual env vars are `NEXT_PUBLIC_FHENIX_RPC_URL` / `NEXT_PUBLIC_FHOX_FACTORY`.
- `packages/contracts/deployments/fhenix-nitrogen.json` — stale Fhenix Helium/Nitrogen deployment artifact (the Helium testnet is deprecated).
