import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arbitrumSepolia } from "@fhox/sdk";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc"),
  },
  ssr: true,
});
