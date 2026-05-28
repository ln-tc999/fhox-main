import { type Account, type Hex, type WalletClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "./chains.js";

/**
 * Signer abstraction. v1 supports only local private keys via {@link privateKeySigner},
 * but the interface is shaped so v2 can drop in Turnkey / AWS KMS / Privy / Safe wallets
 * without changing the public SDK surface.
 *
 * The shape mirrors viem's `Account` so any signer is directly usable as `walletClient.account`.
 */
export type Signer = Account;

export type LocalSignerOptions = {
  privateKey: Hex;
};

/**
 * Build a Signer from a raw private key. Use only in trusted environments
 * (server, CLI, MCP). Never expose this in browser code.
 */
export function privateKeySigner(opts: LocalSignerOptions): Signer {
  if (!opts.privateKey.startsWith("0x") || opts.privateKey.length !== 66) {
    throw new Error("Invalid private key: expected 0x-prefixed 64-character hex string");
  }
  return privateKeyToAccount(opts.privateKey);
}

/**
 * Convenience factory: build a viem wallet client + public client for Arc Testnet
 * from a private key and RPC URL. Use this when you want a one-shot config for
 * the SDK without managing viem clients yourself.
 */
export function arcTestnetWalletClient(opts: { rpcUrl: string; privateKey: Hex }): WalletClient {
  const account = privateKeySigner({ privateKey: opts.privateKey });
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(opts.rpcUrl),
  });
}
