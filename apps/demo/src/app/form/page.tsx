"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { arcTestnet } from "@corpus/sdk";
import { FormHeader } from "@/components/form/FormHeader";
import { FormationWizard } from "@/components/form/FormationWizard";
import { Sealed } from "@/components/form/Sealed";
import { MyAgents } from "@/components/form/MyAgents";

export default function FormPage() {
  const { isConnected, chainId } = useAccount();
  const onArc = chainId === arcTestnet.id;
  const [formed, setFormed] = useState<{
    manager: Address;
    tokenId: bigint;
    legalName: string;
  } | null>(null);

  return (
    <main className="relative min-h-screen bg-obsidian text-bone overflow-x-hidden">
      <div
        aria-hidden
        className="absolute -left-[15%] top-0 w-[55%] h-[65%] rounded-full blur-[160px] opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, rgba(200,164,93,0.35), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-[10%] top-[30%] w-[50%] h-[60%] rounded-full blur-[160px] opacity-40"
        style={{
          background:
            "radial-gradient(closest-side, rgba(77,140,255,0.25), transparent 70%)",
        }}
      />

      <FormHeader />

      <section className="relative z-10 px-6 md:px-16 pt-20 pb-24 max-w-5xl mx-auto">
        {!formed && (
          <div className="mb-20 max-w-3xl">
            <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-8">
              § Formation · One Transaction
            </p>
            <h1 className="serif text-bone text-5xl md:text-7xl font-light leading-[1.04] mb-8">
              Give your agent
              <br />
              <span className="text-stone italic">a legal body.</span>
            </h1>
            <p className="text-stone text-[16px] md:text-[17px] max-w-2xl leading-relaxed font-light">
              One transaction on Arc deploys an algorithmic-manager contract structured as a
              Wyoming DAO LLC under W.S. 17-31-115, mints an{" "}
              <a
                className="text-bone underline underline-offset-[5px] decoration-gold/40 hover:decoration-gold transition-colors"
                href="https://eips.ethereum.org/EIPS/eip-8004"
                target="_blank"
                rel="noreferrer"
              >
                ERC-8004
              </a>{" "}
              identity NFT, and opens a USDC treasury bound by on-chain spending policies and
              binding dispute mediation.
            </p>
          </div>
        )}

        {!isConnected ? (
          <div className="border border-gold/20 bg-oxblood/30 p-10 md:p-14 text-center">
            <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-5">
              Step Zero
            </p>
            <h2 className="serif text-bone text-3xl md:text-4xl font-light mb-4">
              Connect a wallet to begin.
            </h2>
            <p className="text-stone text-sm font-light">
              The connected account becomes the entity&apos;s principal — the address authorized
              to act on its behalf.
            </p>
          </div>
        ) : !onArc ? (
          <div className="border border-red-500/40 bg-red-500/5 p-10 md:p-14">
            <p className="text-[11px] tracking-[0.48em] uppercase text-red-300 mb-5">
              Wrong Network
            </p>
            <h2 className="serif text-bone text-3xl md:text-4xl font-light mb-4">
              Switch to Arc Testnet.
            </h2>
            <p className="text-stone text-sm font-light">
              CORPUS forms entities on Arc Testnet (chain 5042002). Use the switch button in the
              header.
            </p>
          </div>
        ) : formed ? (
          <Sealed
            manager={formed.manager}
            tokenId={formed.tokenId}
            legalName={formed.legalName}
          />
        ) : (
          <div className="space-y-16">
            <FormationWizard
              onFormed={(m, t, n) => setFormed({ manager: m, tokenId: t, legalName: n })}
            />
            <MyAgents />
          </div>
        )}
      </section>

      <footer className="relative z-10 border-t border-gold/10 px-8 md:px-16 py-7 text-[10px] tracking-[0.32em] uppercase text-stone/50 flex flex-col md:flex-row gap-3 md:justify-between">
        <span>Corpus · v0.1 · Arc Testnet</span>
        <span>Agora Agents · Canteen × Circle × Arc</span>
      </footer>
    </main>
  );
}
