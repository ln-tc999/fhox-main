#!/usr/bin/env bash
# End-to-end test of @corpus/sdk + @corpus/cli against real Arc Testnet.
#
# Walks through the full lifecycle:
#   1. whoami        — sanity check
#   2. name-check    — verify name is free
#   3. form          — deploy entity + mint NFT + transfer to principal
#   4. state         — read entity state
#   5. verify        — cryptographic NFT-owner check
#   6. fund          — send USDC from agent → treasury
#   7. pay           — execute payment under policy
#   8. dispute open  — counterparty raises a claim
#   9. dispute get   — read it back
#  10. dispute resolve — mediator awards
#  11. final state  — confirm everything is consistent
#
# Requires env: ARC_RPC_URL, CORPUS_FACTORY, AGENT_PRIVATE_KEY, MEDIATOR_PRIVATE_KEY
# (the mediator must be a separate wallet because principal ≠ mediator is enforced)

set -euo pipefail

CORPUS="node $(cd "$(dirname "$0")" && pwd)/dist/index.js"

# Pretty
B="\033[1m"; G="\033[32m"; Y="\033[33m"; C="\033[36m"; D="\033[2m"; R="\033[0m"

echo -e "${B}━━━ CORPUS E2E ━━━${R}"
echo -e "${D}rpc: $ARC_RPC_URL${R}"
echo -e "${D}factory: $CORPUS_FACTORY${R}"
echo

# ─── 1. whoami ──────────────────────────────────────────────────────────────
echo -e "${B}[1/11] whoami${R}"
WHOAMI_JSON=$($CORPUS --json whoami)
PRINCIPAL=$(echo "$WHOAMI_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).address))')
echo -e "  principal: ${C}$PRINCIPAL${R}"
echo "$WHOAMI_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log("  usdc balance:",j.usdcBalance)})'
echo

# Compute mediator address from MEDIATOR_PRIVATE_KEY
if [ -z "${MEDIATOR_PRIVATE_KEY:-}" ]; then
  echo "ERROR: set MEDIATOR_PRIVATE_KEY env var (a different wallet than AGENT_PRIVATE_KEY)"
  exit 1
fi
MEDIATOR=$(cd "$(dirname "$0")" && node -e "
import('viem/accounts').then(({ privateKeyToAccount }) => {
  console.log(privateKeyToAccount(process.env.MEDIATOR_PRIVATE_KEY).address);
});
")
echo -e "  mediator: ${C}$MEDIATOR${R}"
echo

# ─── 2. name-check ──────────────────────────────────────────────────────────
LEGAL_NAME="E2E Test LLC $(date +%s)"
echo -e "${B}[2/11] name-check \"$LEGAL_NAME\"${R}"
$CORPUS name-check "$LEGAL_NAME"
echo

# ─── 3. form ────────────────────────────────────────────────────────────────
echo -e "${B}[3/11] form${R}"
FORM_JSON=$($CORPUS --json form \
  --name "$LEGAL_NAME" \
  --jurisdiction WY \
  --mediator "$MEDIATOR" \
  --daily-cap "100" \
  --uri "ipfs://e2e-test")
MANAGER=$(echo "$FORM_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).manager))')
TOKEN_ID=$(echo "$FORM_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).identityTokenId))')
echo -e "  ${G}✓${R} manager:  ${C}$MANAGER${R}"
echo -e "  ${G}✓${R} token id: $TOKEN_ID"
echo

# ─── 4. state ───────────────────────────────────────────────────────────────
echo -e "${B}[4/11] state${R}"
$CORPUS state "$MANAGER" | sed 's/^/  /'
echo

# ─── 5. verify ──────────────────────────────────────────────────────────────
echo -e "${B}[5/11] verify${R}"
$CORPUS verify "$MANAGER" | sed 's/^/  /'
echo

# ─── 6a. fund mediator wallet for gas ───────────────────────────────────────
echo -e "${B}[6/11] fund mediator wallet 0.5 USDC for gas, treasury 5 USDC${R}"
$CORPUS fund "$MEDIATOR" "0.5" | sed 's/^/  /'
echo
$CORPUS fund "$MANAGER" "5" | sed 's/^/  /'
echo

# ─── 7. pay ────────────────────────────────────────────────────────────────
# Counterparty = mediator (a real address that exists). Could be any address.
echo -e "${B}[7/11] pay 1 USDC to counterparty${R}"
COUNTERPARTY=$MEDIATOR
$CORPUS pay "$MANAGER" "$COUNTERPARTY" "1" --memo "e2e test invoice" | sed 's/^/  /'
echo

# ─── 8. dispute open ────────────────────────────────────────────────────────
echo -e "${B}[8/11] dispute open (counterparty claims 2 USDC)${R}"
# Principal opens on behalf for the test (would normally be the counterparty)
DISPUTE_JSON=$($CORPUS --json dispute open "$MANAGER" "$COUNTERPARTY" "2" "test claim")
DISPUTE_ID=$(echo "$DISPUTE_JSON" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).disputeId))')
echo -e "  ${G}✓${R} dispute id: $DISPUTE_ID"
echo

# ─── 9. dispute get ─────────────────────────────────────────────────────────
echo -e "${B}[9/11] dispute get #$DISPUTE_ID${R}"
$CORPUS dispute get "$MANAGER" "$DISPUTE_ID" | sed 's/^/  /'
echo

# ─── 10. dispute resolve (as mediator) ──────────────────────────────────────
echo -e "${B}[10/11] dispute resolve (mediator awards 1 USDC)${R}"
AGENT_PRIVATE_KEY="$MEDIATOR_PRIVATE_KEY" \
  $CORPUS dispute resolve "$MANAGER" "$DISPUTE_ID" "1" 2>&1 | sed 's/^/  /'
echo

# ─── 11. final state ────────────────────────────────────────────────────────
echo -e "${B}[11/11] final state${R}"
$CORPUS state "$MANAGER" | sed 's/^/  /'
echo

echo -e "${G}━━━ E2E PASSED ━━━${R}"
echo -e "${D}manager: $MANAGER${R}"
echo -e "${D}view on Arcscan: https://testnet.arcscan.app/address/$MANAGER${R}"
