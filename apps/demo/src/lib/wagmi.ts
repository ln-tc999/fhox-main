import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { fhenixNitrogen } from "@fhox/sdk";

export const wagmiConfig = createConfig({
  chains: [fhenixNitrogen],
  connectors: [injected()],
  transports: {
    [fhenixNitrogen.id]: http(process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? "https://api.nitrogen.fhenix.zone"),
  },
  ssr: true,
});
