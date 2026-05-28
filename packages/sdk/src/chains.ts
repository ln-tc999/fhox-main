import { defineChain } from "viem";

/** Arc Testnet — Circle's USDC-native L1. USDC is the gas token. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/** Canonical pre-deployed contract addresses on Arc Testnet. */
export const ARC_TESTNET_ADDRESSES = {
  /** USDC ERC-20 interface — same balance as native gas, 6 decimals. */
  usdc: "0x3600000000000000000000000000000000000000",
  /** ERC-8004 IdentityRegistry — agents' onchain identity NFTs. */
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  /** ERC-8004 ReputationRegistry — feedback attestations. */
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  /** ERC-8004 ValidationRegistry — independent verification. */
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
} as const;
