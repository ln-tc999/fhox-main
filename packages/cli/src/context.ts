import { FhoxClient, arbitrumSepolia, fhenixWalletClient } from "@fhox/sdk";
import { type Address, type Hex, createPublicClient, getAddress, http } from "viem";

export type CliEnv = {
  rpcUrl: string;
  factory: Address;
  privateKey: Hex;
};

export function loadEnv(): CliEnv {
  const rpcUrl = process.env.FHENIX_RPC_URL;
  const factory = process.env.FHOX_FACTORY;
  const privateKey = process.env.AGENT_PRIVATE_KEY;

  const missing: string[] = [];
  if (!rpcUrl) missing.push("FHENIX_RPC_URL");
  if (!factory) missing.push("FHOX_FACTORY");
  if (!privateKey) missing.push("AGENT_PRIVATE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\n\n` +
        `Set them in your shell or in a .env file:\n` +
        `  FHENIX_RPC_URL=<arbitrum sepolia rpc>\n` +
        `  FHOX_FACTORY=0x...\n` +
        `  AGENT_PRIVATE_KEY=0x...`,
    );
  }

  if (!privateKey!.startsWith("0x") || privateKey!.length !== 66) {
    throw new Error("AGENT_PRIVATE_KEY must be a 0x-prefixed 64-char hex string");
  }

  return {
    rpcUrl: rpcUrl!,
    factory: getAddress(factory!),
    privateKey: privateKey as Hex,
  };
}

export function makeClient(env: CliEnv = loadEnv()): FhoxClient {
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(env.rpcUrl),
  });
  const walletClient = fhenixWalletClient({
    rpcUrl: env.rpcUrl,
    privateKey: env.privateKey,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new FhoxClient({ publicClient: publicClient as any, walletClient, factory: env.factory });
}
