"use client";

import { useEffect, useState } from "react";
import { type Address, createPublicClient, http } from "viem";
import { fhenixNitrogen, fhoxManagerAbi } from "@fhox/sdk";
import { PassportCard } from "./PassportCard";

export function PassportLive({ manager }: { manager: Address }) {
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = createPublicClient({
          chain: fhenixNitrogen,
          transport: http(process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? "/api/rpc"),
        });
        const id = (await client.readContract({
          address: manager,
          abi: fhoxManagerAbi,
          functionName: "identityTokenId",
        })) as bigint;
        if (cancelled) return;
        setTokenId(id);
      } catch (e) {
        if (cancelled) return;
        const err = e as Record<string, unknown>;
        setError((err?.shortMessage as string) || (err?.message as string) || "Failed to load.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manager]);

  if (error) {
    return (
      <div className="border border-red-500/40 bg-red-500/5 p-10 text-red-300 font-mono text-[12px] break-words">
        {error}
      </div>
    );
  }

  if (tokenId === null) {
    return (
      <div className="border border-gold/15 bg-oxblood/20 p-10 md:p-14 flex items-center gap-4 text-stone">
        <span className="block w-2 h-2 rounded-full bg-gold/80 animate-seal-pulse" />
        <span className="text-[11px] tracking-[0.32em] uppercase">Loading entity from Arc…</span>
      </div>
    );
  }

  return <PassportCard manager={manager} tokenId={tokenId} />;
}
