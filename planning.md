# FHOX — Next Steps Planning

## 1. Hardhat Tests (Priority: High)

**Why first:** Can't confidently deploy without verifying CoFHE two-phase flow works under the mock.

### What to build
File: `packages/contracts/test-hardhat/FhoxFactory.test.ts`

Test cases:
1. **`form()` — happy path**
   - Deploy factory with MockUSDC + MockIdentityRegistry
   - Call `factory.form(...)` with trivially-encrypted daily cap (`{ctHash: 1000_000000n, securityZone: 0, utype: 6, signature: "0x"}`)
   - Assert: `FhoxFormed` event emitted, manager address non-zero, identity token ID > 0
   - Assert: `manager.metadata().legalName` matches input

2. **`pay()` → `executePayment()` — two-phase happy path**
   - Fund manager with MockUSDC (`usdc.transfer(manager, 500_000000n)`)
   - Call `manager.pay(counterparty, encAmount, memoHash)` → get `paymentId`
   - Assert `PaymentInitiated` event emitted
   - `evm_increaseTime(15)` + `evm_mine` (MockTaskManager needs ≥1s)
   - Call `manager.executePayment(paymentId)`
   - Assert counterparty's USDC balance increased
   - Assert `PaymentExecuted` event emitted

3. **Daily cap enforcement**
   - Form entity with cap = 100 USDC
   - Pay 80 USDC → executePayment → succeeds (actual transfer = 80)
   - Pay 80 USDC again → executePayment → actual transfer should be capped at remaining 20 (FHE.select silently caps, doesn't revert)

4. **Allowlist enforcement**
   - Form with `allowlistOnly = true`
   - `pay()` to non-listed address → should revert with `CounterpartyNotAllowed`
   - `setAllowlist(addr, true)` → pay succeeds

5. **`getSealedDailyCap()` — sealed read**
   - Call from principal → returns bytes32 handle (non-zero)
   - Call from non-principal → should revert with `NotPrincipal`

### Notes
- Import `@cofhe/mock-contracts` for `MockTaskManager` — it's already in `hardhat.config.ts` as a fixture
- Use `ethers.provider.send("evm_increaseTime", [15])` between phases
- The mock doesn't require real FhenixClient encryption — trivial encoding `{ctHash: amount, securityZone: 0, utype: 6, signature: "0x"}` works

---

## 2. Deploy Script (Priority: Medium)

**Current state:** `scripts/deploy.ts` exists but deploys MockUSDC + MockIdentityRegistry unconditionally — wrong for Fhenix Nitrogen where real addresses exist (or should be supplied).

### What to fix
File: `packages/contracts/scripts/deploy.ts`

Changes needed:
1. **Accept real addresses via env vars** — if `USDC_ADDRESS` and `IDENTITY_REGISTRY_ADDRESS` are set, skip mock deployment; otherwise deploy mocks (local only)
2. **Write `.env` update** — after deploy, print the env vars to set:
   ```
   FHOX_FACTORY=0x...
   NEXT_PUBLIC_FHOX_FACTORY=0x...
   ```
   Or write directly to `../../.env` if it exists
3. **Remove unused `FhenixClient` import** — it's imported but never used
4. **Add `deployments/` dir check** — `fs.mkdirSync("deployments", { recursive: true })` before writeFileSync

### Fhenix Nitrogen known addresses
- USDC (testnet): needs to be sourced from Fhenix docs / faucet — add as `USDC_ADDRESS` env var
- IdentityRegistry: deployed by FHOX — address from previous deployment or deploy fresh

---

## 3. CLI + MCP `executePayment` (Priority: Medium)

**Current state:** `cli/src/commands/pay.ts` calls `c.pay()` and immediately does `tx.wait()` — this treats payment as single-phase. With CoFHE, `pay()` returns a `paymentId` and the actual transfer only happens after `executePayment()` in a later block.

### CLI changes

**`packages/cli/src/commands/pay.ts`** — fix to two-phase:
- Phase 1: call `c.pay(...)` → emit `paymentId` prominently
- Do NOT call `executePayment` automatically (user may want to wait, inspect, etc.)
- Output should say: `⏳ payment queued — run: fhox execute-payment <manager> <paymentId>`

**New file: `packages/cli/src/commands/execute-payment.ts`**
```
fhox execute-payment <manager> <paymentId>
```
- Calls `c.executePayment(manager, paymentId)`
- Emits tx hash + status

Register in `packages/cli/src/index.ts`.

### MCP changes

**`packages/mcp/src/index.ts`**

`fhox_pay` tool — update description and output:
- Return `{ paymentId, txHash }` instead of pretending payment is complete
- Add note: "Call `fhox_execute_payment` after ≥1 block"

New tool **`fhox_execute_payment`**:
```ts
{
  name: "fhox_execute_payment",
  description: "Phase-2 of a CoFHE payment: execute a pending payment once the async decrypt is ready (≥1 block after fhox_pay).",
  inputSchema: {
    manager: { type: "string" },
    paymentId: { type: "string" },  // bigint as string
  }
}
```

---

## Order of execution

```
1. Hardhat tests      → validates contracts work
2. Deploy script fix  → deploy to Fhenix Nitrogen
3. CLI / MCP fix      → two-phase pay UX
```

Once (2) is done, update `CLAUDE.md` with deployed addresses under "Fhenix Nitrogen Testnet".
