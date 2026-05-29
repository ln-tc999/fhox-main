"use client";

import { useEffect, useState } from "react";
import { type Address, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { fhoxManagerAbi, ARBITRUM_SEPOLIA_ADDRESSES } from "@fhox/sdk";

export function EntityCard({ manager, tokenId }: { manager: Address; tokenId: bigint }) {
  const publicClient = usePublicClient();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [meta, setMeta] = useState<{ legalName: string; jurisdiction: string } | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const [bal, m] = await Promise.all([
          publicClient.readContract({
            address: manager,
            abi: fhoxManagerAbi,
            functionName: "treasuryBalance",
          }) as Promise<bigint>,
          publicClient.readContract({
            address: manager,
            abi: fhoxManagerAbi,
            functionName: "metadata",
          }) as Promise<{ legalName: string; jurisdiction: string }>,
        ]);
        if (cancelled) return;
        setBalance(bal);
        setMeta({ legalName: m.legalName, jurisdiction: m.jurisdiction });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, manager]);

  return (
    <div className="border border-ink/15 bg-white p-8 max-w-2xl">
      <div className="text-xs uppercase tracking-widest text-ink/50 mb-2">Entity formed</div>
      <div className="serif text-3xl mb-4">{meta?.legalName ?? "—"}</div>
      <div className="grid grid-cols-2 gap-y-3 font-mono text-sm">
        <span className="text-ink/50">manager</span>
        <a
          className="truncate underline underline-offset-4"
          href={`https://sepolia.arbiscan.io/address/${manager}`}
          target="_blank"
          rel="noreferrer"
        >
          {manager}
        </a>
        <span className="text-ink/50">erc-8004 token</span>
        <a
          className="underline underline-offset-4"
          href={`https://sepolia.arbiscan.io/address/${ARBITRUM_SEPOLIA_ADDRESSES.identityRegistry}?a=${tokenId}`}
          target="_blank"
          rel="noreferrer"
        >
          #{tokenId.toString()}
        </a>
        <span className="text-ink/50">treasury</span>
        <span>{balance !== null ? `${formatUnits(balance, 6)} USDC` : "…"}</span>
        <span className="text-ink/50">jurisdiction</span>
        <span>{meta?.jurisdiction ?? "—"}</span>
      </div>

      <div className="mt-6 text-xs text-ink/50 leading-relaxed">
        Fund this treasury by sending USDC to <span className="font-mono">{manager.slice(0, 10)}…</span> from{" "}
        <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
          faucet.circle.com
        </a>
        . Once funded, the principal can call <span className="font-mono">pay()</span> on the manager
        and the policy is enforced on-chain.
      </div>
    </div>
  );
}
