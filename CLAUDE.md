# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FHOX** is a privacy-first Web3 protocol that gives AI agents legal personhood as Wyoming DAO LLCs on **Fhenix** (FHE blockchain). A single `FhoxFactory.form()` transaction atomically deploys a manager contract, mints an ERC-8004 identity NFT, and establishes a treasury — with payment amounts and spending totals **FHE-encrypted** using Fhenix CoFHE. On-chain observers see that a payment occurred but never the amount.

**Key privacy design**: `FhoxManager` stores daily spending cap and running totals as `euint128` (Fhenix FHE ciphertexts). Payment amounts are encrypted client-side via `@cofhe/sdk` before being submitted. Cap enforcement uses `FHE.select()` instead of a conditional revert (standard FHE-native pattern).

## Commands

Requires Node.js >= 20 and pnpm 11.1.2.

```bash
# Root-level
pnpm build                        # Build all packages
pnpm test                         # Run all tests
pnpm dev                          # Start Next.js demo on port 3000

# Contracts (Foundry — pure logic)
pnpm contracts:build              # forge build
pnpm contracts:test               # forge test -vv

# Contracts (Hardhat — Fhenix FHE)
pnpm contracts:hardhat:build      # npx hardhat compile
pnpm contracts:hardhat:test       # npx hardhat test (with FHE mock)
pnpm contracts:deploy:fhenix      # deploy to Fhenix Nitrogen testnet

# SDK / CLI / MCP (inside their packages)
pnpm build                        # tsc
pnpm dev                          # tsc --watch

# Demo app
pnpm dev                          # Next.js + Turbopack
pnpm lint                         # next lint
```

## Environment Setup

Copy `.env.example` to `.env`:
- `FHENIX_RPC_URL` — Fhenix Nitrogen RPC (default: `https://api.nitrogen.fhenix.zone`)
- `DEPLOYER_PRIVATE_KEY` — testnet wallet key (fund from `https://faucet.nitrogen.fhenix.zone`)
- `FHOX_FACTORY` — deployed factory address (populated after `deploy:fhenix`)
- `NEXT_PUBLIC_FHOX_FACTORY` — same, for demo app
- `NEXT_PUBLIC_FHENIX_RPC_URL` — Fhenix RPC for frontend
- `AGENT_PRIVATE_KEY` — for CLI/MCP usage

## Architecture

pnpm monorepo (`pnpm-workspace.yaml`):

```
packages/
  contracts/   Foundry + Hardhat — FhoxFactory + FhoxManager (Fhenix FHE)
  sdk/         @fhox/sdk — viem + @cofhe/sdk TypeScript client
  cli/         @fhox/cli — Commander CLI (bin: fhox)
  mcp/         @fhox/mcp — MCP server (bin: fhox-mcp)
apps/
  demo/        Next.js 15 + React 19 + Wagmi + Three.js demo
```

### Smart Contracts (`packages/contracts/src/`)

- **`FhoxFactory.sol`** — single entrypoint; atomically deploys manager, mints ERC-8004 identity, emits `FhoxFormed`
- **`FhoxManager.sol`** — LLC contract with FHE-encrypted treasury; holds USDC, enforces policy on encrypted values
- **`interfaces/IFhoxManager.sol`** — contract interface; `pay()` takes `inEuint128 encAmount`

**FHE state variables in FhoxManager:**
```solidity
euint128 internal _encDailyCap;              // encrypted spending cap
mapping(uint256 => euint128) _encSpentOnDay; // encrypted daily totals
bool public hasDailyCap;                      // plaintext flag (values are private)
bool public allowlistOnly;                    // plaintext flag
```

**Sealed reads** (principal-only): `getSealedDailyCap(permission)`, `getSealedTodaySpent(permission)` — use `@cofhe/sdk` `FhenixClient.unseal()` to decrypt.

Two build tools:
- **Foundry**: `forge build/test` for pure Solidity logic (no FHE mock yet)
- **Hardhat**: `hardhat.config.ts` with `@fhenixprotocol/hardhat-plugin` for local FHE emulation and Fhenix deployment

### SDK (`packages/sdk/src/`)

- **`client.ts`** — `FhoxClient` class; `pay()` calls `_encryptUint128()` internally before sending tx
- **`chains.ts`** — `fhenixNitrogen` viem chain config (chainId 8008148)
- **`abis.ts`** — `fhoxFactoryAbi`, `fhoxManagerAbi`; `pay()` ABI uses `inEuint128` as `tuple { ctHash: bytes }`
- **`types.ts`** — `PolicyView` (public flags only, no cap value); `FhePermission` for sealed reads
- **`signer.ts`** — `fhenixWalletClient()` helper

`FhoxClient` accepts optional `fhenixClient` (from `@cofhe/sdk`) — if provided, encrypts amounts via real FHE; otherwise falls back to trivial encoding for local tests.

### Demo App (`apps/demo/src/`)

- `components/form/FormationWizard.tsx` — 4-step wizard; encrypts daily cap before `client.form()`
- `lib/wagmi.ts` — uses `fhenixNitrogen` chain
- Provider stack: Wagmi + React Query in `app/layout.tsx`
- React Strict Mode disabled (`next.config.ts`) — Three.js WebGL context exhaustion on double-mounts

### Fhenix Nitrogen Testnet

- Chain ID: `8008148`
- RPC: `https://api.nitrogen.fhenix.zone`
- Explorer: `https://explorer.nitrogen.fhenix.zone`
- Faucet: `https://faucet.nitrogen.fhenix.zone`

Addresses populated after running `deploy:fhenix`. No canonical pre-deployed addresses (unlike Arc Testnet).

## Key Patterns

- **FHE amount privacy**: `pay()` takes `inEuint128` (client-encrypted); amount never appears in calldata or events
- **Cap enforcement via FHE.select()**: can't revert on encrypted values; contract silently caps transfer at remaining budget
- **Sealed output**: `getSealedDailyCap()` / `getSealedTodaySpent()` use `Permissioned.onlySender()` to restrict reads to the principal
- **Single-tx factory**: `FhoxFactory.form()` is atomic — deploy + mint + emit in one call
- **Wyoming DAO LLC**: `FhoxManager` is the algorithmic manager under W.S. 17-31-115
- **OpenZeppelin submodule**: run `git submodule update --init` after cloning
