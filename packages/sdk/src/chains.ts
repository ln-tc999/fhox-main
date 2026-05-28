import { defineChain } from "viem";

/** Fhenix Nitrogen Testnet — FHE-enabled chain for privacy-native smart contracts. */
export const fhenixNitrogen = defineChain({
  id: 8008148,
  name: "Fhenix Nitrogen",
  nativeCurrency: { name: "tFHE", symbol: "tFHE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.nitrogen.fhenix.zone"] },
  },
  blockExplorers: {
    default: { name: "Fhenix Explorer", url: "https://explorer.nitrogen.fhenix.zone" },
  },
  testnet: true,
});

/** Canonical addresses on Fhenix Nitrogen. Update after deploying mocks or using production addresses. */
export const FHENIX_NITROGEN_ADDRESSES = {
  /** MockUSDC or real stablecoin — set via FHOX_USDC env var or update after deploy. */
  usdc: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  /** MockIdentityRegistry or real ERC-8004 — set via FHOX_IDENTITY_REGISTRY env var. */
  identityRegistry: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;
