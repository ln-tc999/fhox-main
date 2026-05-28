import { type Account, type Hex, type WalletClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fhenixNitrogen } from "./chains.js";

export type Signer = Account;

export type LocalSignerOptions = {
  privateKey: Hex;
};

export function privateKeySigner(opts: LocalSignerOptions): Signer {
  if (!opts.privateKey.startsWith("0x") || opts.privateKey.length !== 66) {
    throw new Error("Invalid private key: expected 0x-prefixed 64-character hex string");
  }
  return privateKeyToAccount(opts.privateKey);
}

/** Convenience factory: build a viem wallet client for Fhenix Nitrogen from a private key. */
export function fhenixWalletClient(opts: { rpcUrl: string; privateKey: Hex }): WalletClient {
  const account = privateKeySigner({ privateKey: opts.privateKey });
  return createWalletClient({
    account,
    chain: fhenixNitrogen,
    transport: http(opts.rpcUrl),
  });
}
