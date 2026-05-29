# FHOX Demo Script — Video Walkthrough

**Duration**: ~3–4 menit  
**Target**: AI builders, crypto-native founders, Wyoming DAO enthusiasts  
**Tone**: Clean, futuristic, slightly serious — no jokes, no hype, just demo

---

## Scene 1: Landing Page (30 detik)

**Visual**: Buka https://fhox-app.vercel.app

**Narasi**:
> FHOX gives AI agents a legal identity — a Wyoming DAO LLC, deployed in one transaction on Arbitrum Sepolia.

**Gerakan**:
- Scroll pelan dari hero → "The Missing Layer" → "The Body" (5 organs)
- Berhenti sebentar di "The Passport" section
- Lanjut ke "The Stack" (Arbitrum Sepolia, CoFHE, USDC, ERC-8004)

**Cut to**:

---

## Scene 2: Form Entity (45 detik)

**Visual**: Klik "Form an Agent" → `/form` page

**Narasi**:
> Let's form one. Just a legal name, a mediator address, and one click.

**Gerakan**:
- Isi form:
  - **Legal Name**: `Neural Arbitrage DAO LLC`
  - **Mediator**: `0x3131...c9a4` (paste contoh address)
  - **Daily Cap**: `10000` (opsional — kasih tau ini FHE-encrypted)
- Klik submit
- **Loading state** — tunjukkin bahwa ini satu tx: deploy manager contract + mint NFT + transfer

**Cut to**:

---

## Scene 3: Passport / Entity State (30 detik)

**Visual**: Habis form sukses, redirect ke `/passport/[manager]`

**Narasi**:
> Instantly, the agent has a passport — an on-chain identity you can verify anywhere.

**Gerakan**:
- Scroll passport page:
  - Entity name, jurisdiction, status "Active"
  - Treasury, daily cap
  - Mediator address
- Tunjukkin "Verified Entity" badge

**Cut to**:

---

## Scene 4: CLI — name-check + whoami (30 detik)

**Visual**: Terminal split-screen atau overlay

**Narasi**:
> The same from terminal. Check if a name's taken, see your agent's identity.

**Gerakan**:
```bash
fhox name-check "Neural Arbitrage DAO LLC"
# → { taken: false }

fhox whoami
# → address, factory, usdc balance
```

**Cut to**:

---

## Scene 5: CLI — state + policy (30 detik)

**Visual**: Lanjut terminal

**Narasi**:
> Read entity state — treasury, daily cap, allowlist — all FHE-encrypted. Update policy anytime.

**Gerakan**:
```bash
fhox state 0x<manager-address>
# → metadata, policy, treasury

fhox policy 0x<manager-address> --daily-cap 5000 --allowlist-only
# → policy updated
```

**Cut to**:

---

## Scene 6: CLI — pay (30 detik)

**Visual**: Terminal + explorer tab (Arbiscan)

**Narasi**:
> Pay a counterparty under the entity's spending policy. The daily cap check is FHE — no one sees how much.

**Gerakan**:
```bash
fhox pay 0x<manager> 0x<counterparty> 100 --memo "Q1 inference compute"
# → paymentId, txHash
```

**Cut to**:

---

## Scene 7: MCP — AI agent integration (30 detik)

**Visual**: Cursor/Claude Desktop config + chat

**Narasi**:
> And for AI-native workflows — FHOX ships as an MCP server. Any MCP-aware host can form entities, check state, and execute payments.

**Gerakan**:
- Tunjukkin `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "fhox": {
      "command": "fhox-mcp",
      "env": {
        "FHENIX_RPC_URL": "...",
        "FHOX_FACTORY": "0xEAf...3A9",
        "AGENT_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```
- Demo chat: "check if Neural Arbitrage DAO LLC is taken" → MCP responds

**Cut to**:

---

## Scene 8: Outro (15 detik)

**Visual**: Balik ke landing page → scroll ke "The next company may not have humans"

**Narasi**:
> FHOX — the legal body for AI agents. Open source, on-chain, privacy-first.  
> fhox-app.vercel.app

**Text overlay**: `https://fhox-app.vercel.app` + `github.com/maulana-tech/fhox-main`

---

## Tech notes for recording

| Item | Detail |
|---|---|
| Screen size | 1440×900 atau 1920×1080 |
| Browser | Chrome with "React Developer Tools" hidden |
| Terminal | iTerm2 / Warp, dark theme, font: JetBrains Mono 14px |
| Recording | ⌘+Shift+5 (QuickTime) atau Screen Studio |
| Audio | Condenser mic, background noise < -60dB |
| Cuts | No jumpcuts — use crossfade 0.3s or smooth scroll |

## Env vars needed during recording

```bash
export FHENIX_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
export FHOX_FACTORY="0xEAfd45D5E7ECCF6014D91D9e3da39134C347f3A9"
export AGENT_PRIVATE_KEY="0x..."
```

> **Important**: Use a throwaway wallet for recording — the private key is visible in Scene 4-6.
