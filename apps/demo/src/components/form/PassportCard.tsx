"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Address, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { fhoxManagerAbi, ARBITRUM_SEPOLIA_ADDRESSES } from "@fhox/sdk";

type Metadata = { legalName: string; jurisdiction: string };

export function PassportCard({
  manager,
  tokenId,
  legalName,
}: {
  manager: Address;
  tokenId: bigint;
  legalName?: string;
}) {
  const publicClient = usePublicClient();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [meta, setMeta] = useState<Metadata | null>(legalName ? { legalName, jurisdiction: "WY" } : null);
  const [policy, setPolicy] = useState<{ dailyCap: bigint; allowlistOnly: boolean } | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      const tryRead = async <T,>(fn: string): Promise<T | null> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (await publicClient.readContract({
            address: manager,
            abi: fhoxManagerAbi,
            functionName: fn as any,
          })) as T;
        } catch (e) {
          console.warn(`[passport] read '${fn}' failed`, e);
          return null;
        }
      };

      const [bal, m, p] = await Promise.all([
        tryRead<bigint>("treasuryBalance"),
        tryRead<Metadata>("metadata"),
        tryRead<{ dailyCapUsdc: bigint; allowlistOnly: boolean }>("policy"),
      ]);
      if (cancelled) return;
      if (bal !== null) setBalance(bal);
      if (m) setMeta({ legalName: m.legalName, jurisdiction: m.jurisdiction });
      if (p) setPolicy({ dailyCap: p.dailyCapUsdc, allowlistOnly: p.allowlistOnly });
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, manager]);

  return (
    <div className="relative">
      <span className="absolute -top-px -left-px w-7 h-7 border-t border-l border-gold" />
      <span className="absolute -top-px -right-px w-7 h-7 border-t border-r border-gold" />
      <span className="absolute -bottom-px -left-px w-7 h-7 border-b border-l border-gold" />
      <span className="absolute -bottom-px -right-px w-7 h-7 border-b border-r border-gold" />

      <div className="border border-gold/40 bg-oxblood/40 backdrop-blur-sm p-10 md:p-12">
        <div className="flex items-start justify-between mb-10 gap-6">
          <div>
            <p className="text-[10px] tracking-[0.48em] uppercase text-gold/80 mb-3">
              FHOX Passport
            </p>
            <h3 className="serif text-bone text-3xl md:text-4xl font-light tracking-wide">
              {meta?.legalName ?? "—"}
            </h3>
            <p className="mt-3 flex items-center gap-2.5 text-[11px] tracking-[0.32em] uppercase text-verified">
              <span className="block w-1.5 h-1.5 rounded-full bg-verified animate-seal-pulse" />
              Active · On-Chain
            </p>
          </div>
          <div className="relative w-16 h-16 rounded-full border border-gold/60 flex items-center justify-center animate-seal-pulse">
            <span className="serif text-gold text-2xl">C</span>
            <span className="absolute inset-0 rounded-full border border-gold/20 scale-[1.18]" />
            <span className="absolute inset-0 rounded-full border border-gold/10 scale-[1.36]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-7 gap-x-10">
          <Field
            k="Manager"
            v={
              <a
                className="underline underline-offset-[6px] decoration-gold/40 hover:decoration-gold transition-colors"
                href={`https://sepolia.arbiscan.io/address/${manager}`}
                target="_blank"
                rel="noreferrer"
              >
                {manager.slice(0, 10)}…{manager.slice(-6)}
              </a>
            }
            mono
          />
          <Field
            k="Identity Token"
            v={
              <a
                className="underline underline-offset-[6px] decoration-gold/40 hover:decoration-gold transition-colors"
                href={`https://sepolia.arbiscan.io/address/${ARBITRUM_SEPOLIA_ADDRESSES.identityRegistry}?a=${tokenId}`}
                target="_blank"
                rel="noreferrer"
              >
                #{tokenId.toString()}
              </a>
            }
            mono
          />
          <Field k="Jurisdiction" v={`Wyoming · ${meta?.jurisdiction ?? "WY"}`} />
          <Field k="Entity Type" v="DAO LLC · W.S. 17-31-115" />
          <Field
            k="Treasury"
            v={balance !== null ? `${formatUnits(balance, 6)} USDC` : "…"}
            mono
          />
          <Field
            k="Daily Cap"
            v={
              policy
                ? policy.dailyCap === 0n
                  ? "Unlimited"
                  : `${Number(formatUnits(policy.dailyCap, 6)).toLocaleString()} USDC`
                : "…"
            }
            mono
          />
          <Field k="Allowlist" v={policy ? (policy.allowlistOnly ? "Enforced" : "Open") : "…"} />
          <Field k="Audit" v="Immutable · Event log" />
        </div>

        <div className="mt-10 pt-6 border-t border-gold/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-[10px] tracking-[0.32em] uppercase text-stone">
            <span className="text-gold/80">Sealed</span> · Arbitrum Sepolia · chain 421614
          </div>
          <Link
            href={`/passport/${manager}`}
            className="text-[11px] tracking-[0.32em] uppercase text-gold hover:text-bone transition-colors flex items-center gap-3"
          >
            Open Passport
            <span>→</span>
          </Link>
        </div>

        <div className="mt-8 px-5 py-4 border border-gold/15 bg-obsidian/40 text-[12px] text-stone leading-relaxed font-light">
          Fund this treasury by sending USDC to{" "}
          <span className="font-mono text-bone">{manager.slice(0, 10)}…</span> from{" "}
          <a
            className="underline underline-offset-[5px] decoration-gold/40 hover:decoration-gold text-bone"
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
          >
            faucet.circle.com
          </a>
          . Once funded, the principal can call{" "}
          <span className="font-mono text-bone">pay()</span> on the manager and the policy is enforced on-chain.
        </div>
      </div>
    </div>
  );
}

function Field({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-stone/70 uppercase tracking-[0.32em] text-[9px] mb-2">{k}</p>
      <p className={`text-bone text-[15px] font-light ${mono ? "font-mono text-[13px]" : ""}`}>{v}</p>
    </div>
  );
}
