"use client";

import type { Address } from "viem";

export type StoredAgent = {
  manager: Address;
  tokenId: string;
  legalName: string;
  jurisdiction: string;
  principal: Address;
  formedAt: number;
  /** webauthx credential id (hex). Empty if user skipped passkey registration. */
  credentialId: string;
  /** Serialized P-256 public key of the passkey (hex). Empty if no passkey. */
  credentialPublicKey: string;
};

const KEY = "fhox.agents.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadAgents(): StoredAgent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAgent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveAgent(agent: StoredAgent) {
  if (!isBrowser()) return;
  const all = loadAgents();
  const next = [
    agent,
    ...all.filter((a) => a.manager.toLowerCase() !== agent.manager.toLowerCase()),
  ];
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function knownCredentials(): { id: `0x${string}`; publicKey: `0x${string}` }[] {
  const map = new Map<string, { id: `0x${string}`; publicKey: `0x${string}` }>();
  for (const a of loadAgents()) {
    if (a.credentialId && a.credentialPublicKey) {
      map.set(a.credentialId.toLowerCase(), {
        id: a.credentialId as `0x${string}`,
        publicKey: a.credentialPublicKey as `0x${string}`,
      });
    }
  }
  return [...map.values()];
}

export function agentsForCredential(credentialId: string): StoredAgent[] {
  const target = credentialId.toLowerCase();
  return loadAgents().filter((a) => a.credentialId.toLowerCase() === target);
}
