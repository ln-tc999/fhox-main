---
project: corpus
version: 0.1.0
last_updated: 2026-05-19
description: Wyoming DAO LLC + ERC-8004 identity + USDC treasury for AI agents, on Arc
capabilities:
  - corpus.form
  - corpus.pay
  - corpus.verify
  - corpus.state
  - corpus.is_name_taken
  - corpus.find_entity_by_name
  - corpus.set_policy
  - corpus.set_allowlist
  - corpus.rotate_principal
  - corpus.rotate_mediator
  - corpus.open_dispute
  - corpus.resolve_dispute
  - corpus.fund
topics:
  - llc-formation
  - agent-identity
  - treasury
  - disputes
  - spending-policy
tags:
  - wyoming
  - erc-8004
  - usdc
  - dao-llc
  - arc
homepage: https://corpus.xyz
repo: https://github.com/ronkenx9/corpus
---

# CORPUS

## What is CORPUS?
CORPUS gives an AI agent a legal body. One transaction deploys a Wyoming DAO LLC manager contract, mints an ERC-8004 identity NFT, and delivers both to the agent. The agent holds the NFT in its wallet; the LLC contract holds the treasury.

## What can a CORPUS entity do?
Hold USDC. Pay counterparties under a configurable spending policy. Open and resolve disputes. Rotate operators. Get cryptographically verified by anyone on Arc.

## How do I form a CORPUS entity?
One transaction. Pick a legal name, name a mediator (a different address than the agent), set a daily spending cap, and call `form()`. The factory deploys a manager contract, mints the identity NFT, transfers it to the agent, and emits the formation event. Through PING: `form llc "My Agent LLC"`.

## What does forming cost?
About 0.11 USDC in Arc gas. There is no protocol fee.

## Who's the principal and who's the mediator?
The principal is the agent that runs the LLC — signs payments, sets the spending policy, manages the allowlist. The mediator is the independent arbiter who resolves disputes. They must be different addresses. The principal can rotate either role later.

## What is the spending policy?
Two knobs: a daily USDC cap (0 = no cap) and an allowlist-only toggle. With allowlist on, payments only succeed to pre-approved counterparties. Both knobs are updatable by the principal.

## How does a payment work?
The agent calls `pay(counterparty, amount, memoHash)` on its manager contract. The contract checks the allowlist (if enabled), checks the daily cap, transfers USDC, and emits a `PaymentExecuted` event. The memoHash is the keccak256 of an off-chain receipt — settles disputes later.

## How does a dispute work?
Only the principal or a known counterparty (one who's received a payment before) can open a dispute. They claim an amount and a reason. The mediator reviews evidence off-chain, then calls `resolveDispute()` to pay an award (up to the claimed amount) from the treasury. There's a 1-day cooldown per counterparty to prevent spam.

## How is a CORPUS entity verified?
Check `ownerOf(identityTokenId)` on the ERC-8004 registry. If the NFT is owned by the principal recorded in the manager contract, the link is intact and the entity is legitimate. Through PING: `llc verify <manager>`.

## What if someone tries to form an LLC with my entity's name?
They can't. The factory enforces a case-insensitive, whitespace-normalized name registry. "Loom Trading LLC", "loom trading llc", and "Loom  Trading  LLC" all collide on the same key. The factory reverts with `NameAlreadyTaken`.

## Where does CORPUS live?
Arc Testnet, chain ID 5042002. The factory is at `0x7A641f73B87CA0b0fE4558a29565c55bE2C8BcEb`. USDC is the native gas asset.

## What's the legal basis?
Wyoming statute W.S. 17-31-115 — when the Articles of Organization name a smart contract as manager and the Operating Agreement references it by address, the contract's behavior is the legally operative authority of the entity.

## Can I move the LLC to a new agent?
Yes. The principal calls `rotatePrincipal(newAddress)`. Note that the identity NFT does not automatically follow — transfer it separately if you want full control transfer. The mediator can also be rotated via `rotateMediator()`.

## What about audits?
CORPUS shipped after a three-round security audit covering 15 issues: reentrancy, frontrun-resistant initialization, name-collision normalization, principal/mediator collision prevention, dispute spam cooldowns, type-consistency, and others. 16 tests pass against the deployed contracts. See the [audit summary](https://github.com/ronkenx9/corpus) in the repo.
