import { arbitrumSepolia } from "viem/chains";

/** Canonical addresses on Arbitrum Sepolia. Update after deploying mocks or using production addresses. */
export const ARBITRUM_SEPOLIA_ADDRESSES = {
  /** MockUSDC or real stablecoin. */
  usdc: "0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D" as `0x${string}`,
  /** MockIdentityRegistry or real ERC-8004. */
  identityRegistry: "0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185" as `0x${string}`,
} as const;

/** Re-export the viem chain for convenience. */
export { arbitrumSepolia };
