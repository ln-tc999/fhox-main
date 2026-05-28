import { CorpusClient, arcTestnet, arcTestnetWalletClient } from "@corpus/sdk";
import { type Address, type Hex, createPublicClient, getAddress, http } from "viem";

export type CliEnv = {
  rpcUrl: string;
  factory: Address;
  privateKey: Hex;
};

export function loadEnv(): CliEnv {
  const rpcUrl = process.env.ARC_RPC_URL;
  const factory = process.env.CORPUS_FACTORY;
  const privateKey = process.env.AGENT_PRIVATE_KEY;

  const missing: string[] = [];
  if (!rpcUrl) missing.push("ARC_RPC_URL");
  if (!factory) missing.push("CORPUS_FACTORY");
  if (!privateKey) missing.push("AGENT_PRIVATE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\n\n` +
        `Set them in your shell or in a .env file:\n` +
        `  ARC_RPC_URL=https://...\n` +
        `  CORPUS_FACTORY=0x7A641f73B87CA0b0fE4558a29565c55bE2C8BcEb\n` +
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

export function makeClient(env: CliEnv = loadEnv()): CorpusClient {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(env.rpcUrl),
  });
  const walletClient = arcTestnetWalletClient({
    rpcUrl: env.rpcUrl,
    privateKey: env.privateKey,
  });
  // viem PublicClient and WalletClient share an interface — the SDK uses both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new CorpusClient({ publicClient: publicClient as any, walletClient, factory: env.factory });
}
