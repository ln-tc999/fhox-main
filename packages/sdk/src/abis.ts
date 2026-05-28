// Curated ABI fragments for the FHOX contracts. Hand-maintained to keep the SDK tiny.
// Full Hardhat artifacts live in packages/contracts/artifacts.

// InEuint128 is the Fhenix CoFHE encrypted input struct (4 fields from ICofhe.sol)
const inEuint128Components = [
  { name: "ctHash", type: "uint256" },
  { name: "securityZone", type: "uint8" },
  { name: "utype", type: "uint8" },
  { name: "signature", type: "bytes" },
] as const;

export const fhoxFactoryAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "usdc_", type: "address" },
      { name: "identityRegistry_", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "form",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "md",
        type: "tuple",
        components: [
          { name: "legalName", type: "string" },
          { name: "jurisdiction", type: "string" },
          { name: "filingId", type: "string" },
          { name: "articlesHash", type: "bytes32" },
          { name: "operatingAgreementHash", type: "bytes32" },
          { name: "formedAt", type: "uint64" },
        ],
      },
      { name: "encDailyCap", type: "tuple", components: inEuint128Components },
      { name: "hasDailyCap_", type: "bool" },
      { name: "allowlistOnly_", type: "bool" },
      { name: "principal_", type: "address" },
      { name: "mediator_", type: "address" },
      { name: "identityMetadataURI", type: "string" },
    ],
    outputs: [
      { name: "manager", type: "address" },
      { name: "identityTokenId", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "FhoxFormed",
    inputs: [
      { name: "manager", type: "address", indexed: true },
      { name: "principal", type: "address", indexed: true },
      { name: "identityTokenId", type: "uint256", indexed: true },
      { name: "legalName", type: "string", indexed: false },
      { name: "jurisdiction", type: "string", indexed: false },
      { name: "filingId", type: "string", indexed: false },
      { name: "articlesHash", type: "bytes32", indexed: false },
      { name: "operatingAgreementHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "isNameTaken",
    stateMutability: "view",
    inputs: [{ name: "legalName", type: "string" }],
    outputs: [
      { name: "taken", type: "bool" },
      { name: "existingManager", type: "address" },
    ],
  },
  {
    type: "function",
    name: "managerByName",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "identityRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "error",
    name: "NameAlreadyTaken",
    inputs: [
      { name: "legalName", type: "string" },
      { name: "existingManager", type: "address" },
    ],
  },
  { type: "error", name: "EmptyLegalName", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
] as const;

export const fhoxManagerAbi = [
  // ── writes ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "counterparty", type: "address" },
      { name: "encAmount", type: "tuple", components: inEuint128Components },
      { name: "memoHash", type: "bytes32" },
    ],
    outputs: [{ name: "paymentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "executePayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "openDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "counterparty", type: "address" },
      { name: "amountClaimed", type: "uint128" },
      { name: "reason", type: "string" },
    ],
    outputs: [{ name: "disputeId", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "disputeId", type: "uint256" },
      { name: "awardToCounterparty", type: "uint128" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAllowlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "counterparty", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encDailyCap", type: "tuple", components: inEuint128Components },
      { name: "hasCap_", type: "bool" },
      { name: "allowlistOnly_", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rotatePrincipal",
    stateMutability: "nonpayable",
    inputs: [{ name: "next", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "rotateMediator",
    stateMutability: "nonpayable",
    inputs: [{ name: "next", type: "address" }],
    outputs: [],
  },

  // ── sealed reads (FHE) ────────────────────────────────────────────────────
  // Non-view: FHE.allowSender() writes to ACL state. Only callable by principal.
  // Returns the euint128 handle (bytes32) — decrypt off-chain with @cofhe/sdk.
  {
    type: "function",
    name: "getSealedDailyCap",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "handle", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSealedTodaySpent",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "handle", type: "bytes32" }],
  },

  // ── public reads ──────────────────────────────────────────────────────────
  { type: "function", name: "principal", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "mediator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "identityTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "treasuryBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hasDailyCap", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowlistOnly", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "allowlist",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "knownCounterparty",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "disputes",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "counterparty", type: "address" },
      { name: "amountAtIssue", type: "uint128" },
      { name: "status", type: "uint8" },
      { name: "openedAt", type: "uint64" },
    ],
  },
  { type: "function", name: "nextDisputeId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nextPaymentId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "pendingPayments",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "counterparty", type: "address" },
      { name: "encActualAmountHandle", type: "bytes32" },
      { name: "memoHash", type: "bytes32" },
      { name: "executed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "metadata",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "legalName", type: "string" },
          { name: "jurisdiction", type: "string" },
          { name: "filingId", type: "string" },
          { name: "articlesHash", type: "bytes32" },
          { name: "operatingAgreementHash", type: "bytes32" },
          { name: "formedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "policyView",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "hasDailyCap", type: "bool" },
          { name: "allowlistOnly", type: "bool" },
        ],
      },
    ],
  },

  // ── events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "PaymentInitiated",
    inputs: [
      { name: "paymentId", type: "uint256", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
      { name: "memoHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PaymentExecuted",
    // amount intentionally omitted — FHE private
    inputs: [
      { name: "counterparty", type: "address", indexed: true },
      { name: "memoHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AllowlistUpdated",
    inputs: [
      { name: "counterparty", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyUpdated",
    // cap value intentionally omitted — FHE private
    inputs: [
      { name: "hasDailyCap", type: "bool", indexed: false },
      { name: "allowlistOnly", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DisputeOpened",
    inputs: [
      { name: "disputeId", type: "uint256", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DisputeResolved",
    inputs: [
      { name: "disputeId", type: "uint256", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
      { name: "awardToCounterparty", type: "uint128", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PrincipalRotated",
    inputs: [
      { name: "previous", type: "address", indexed: true },
      { name: "next", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MediatorRotated",
    inputs: [
      { name: "previous", type: "address", indexed: true },
      { name: "next", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Initialized",
    inputs: [
      { name: "principal", type: "address", indexed: true },
      { name: "mediator", type: "address", indexed: true },
      { name: "identityTokenId", type: "uint256", indexed: false },
    ],
  },

  // ── errors ────────────────────────────────────────────────────────────────
  { type: "error", name: "NotFactory", inputs: [] },
  { type: "error", name: "NotPrincipal", inputs: [] },
  { type: "error", name: "NotMediator", inputs: [] },
  { type: "error", name: "EmptyCounterparty", inputs: [] },
  { type: "error", name: "CounterpartyNotAllowed", inputs: [] },
  { type: "error", name: "DisputeNotOpen", inputs: [] },
  { type: "error", name: "AwardExceedsClaim", inputs: [] },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "NotCounterparty", inputs: [] },
  { type: "error", name: "DisputeCooldown", inputs: [] },
  { type: "error", name: "PrincipalMediatorCollision", inputs: [] },
  { type: "error", name: "PaymentAlreadyExecuted", inputs: [] },
  { type: "error", name: "PaymentNotFound", inputs: [] },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const erc721Abi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "safeTransferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// re-export for downstream use
export { inEuint128Components };
