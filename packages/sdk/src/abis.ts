// Curated ABI fragments for the CORPUS contracts. Hand-maintained to keep the SDK tiny.
// Full Foundry artifacts live in packages/contracts/out.

export const corpusFactoryAbi = [
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
      {
        name: "sp",
        type: "tuple",
        components: [
          { name: "dailyCapUsdc", type: "uint128" },
          { name: "allowlistOnly", type: "bool" },
        ],
      },
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
    name: "CorpusFormed",
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

export const corpusManagerAbi = [
  // ── writes ────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "counterparty", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "memoHash", type: "bytes32" },
    ],
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
      {
        name: "sp",
        type: "tuple",
        components: [
          { name: "dailyCapUsdc", type: "uint128" },
          { name: "allowlistOnly", type: "bool" },
        ],
      },
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

  // ── reads ─────────────────────────────────────────────────────────────────
  { type: "function", name: "principal", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "mediator", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "identityTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "treasuryBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "todaySpent", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
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
    name: "policy",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "dailyCapUsdc", type: "uint128" },
          { name: "allowlistOnly", type: "bool" },
        ],
      },
    ],
  },

  // ── events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "PaymentExecuted",
    inputs: [
      { name: "counterparty", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
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
    inputs: [
      { name: "dailyCapUsdc", type: "uint128", indexed: false },
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

  // ── errors (custom; selector matching for structured errors in SDK) ───────
  { type: "error", name: "NotFactory", inputs: [] },
  { type: "error", name: "NotPrincipal", inputs: [] },
  { type: "error", name: "NotMediator", inputs: [] },
  { type: "error", name: "EmptyCounterparty", inputs: [] },
  { type: "error", name: "CounterpartyNotAllowed", inputs: [] },
  { type: "error", name: "DailyCapExceeded", inputs: [] },
  { type: "error", name: "DisputeNotOpen", inputs: [] },
  { type: "error", name: "AwardExceedsClaim", inputs: [] },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "NotCounterparty", inputs: [] },
  { type: "error", name: "DisputeCooldown", inputs: [] },
  { type: "error", name: "PrincipalMediatorCollision", inputs: [] },
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
