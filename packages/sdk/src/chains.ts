import { arbitrumSepolia } from "viem/chains";

/** Canonical addresses on Arbitrum Sepolia. Update after deploying mocks or using production addresses. */
export const ARBITRUM_SEPOLIA_ADDRESSES = {
  /** MockUSDC or real stablecoin — set via FHOX_USDC env var or update after deploy. */
  usdc: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  /** MockIdentityRegistry or real ERC-8004 — set via FHOX_IDENTITY_REGISTRY env var. */
  identityRegistry: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

/** Re-export the viem chain for convenience. */
export { arbitrumSepolia };
