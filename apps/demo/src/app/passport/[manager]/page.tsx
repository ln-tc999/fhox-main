"use client";

import { use } from "react";
import { isAddress, type Address } from "viem";
import Link from "next/link";
import { FormHeader } from "@/components/form/FormHeader";
import { PassportLive } from "@/components/form/PassportLive";

export default function PassportPage({
  params,
}: {
  params: Promise<{ manager: string }>;
}) {
  const { manager } = use(params);
  const valid = isAddress(manager);

  return (
    <main className="relative min-h-screen bg-obsidian text-bone overflow-x-hidden">
      <div
        aria-hidden
        className="absolute -left-[15%] top-0 w-[55%] h-[65%] rounded-full blur-[160px] opacity-50"
        style={{ background: "radial-gradient(closest-side, rgba(200,164,93,0.35), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="absolute -right-[10%] top-[30%] w-[50%] h-[60%] rounded-full blur-[160px] opacity-40"
        style={{ background: "radial-gradient(closest-side, rgba(77,140,255,0.25), transparent 70%)" }}
      />

      <FormHeader />

      <section className="relative z-10 px-6 md:px-16 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="mb-14">
          <Link
            href="/form"
            className="text-[11px] tracking-[0.32em] uppercase text-stone hover:text-bone transition-colors"
          >
            ← Formation
          </Link>
          <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mt-10 mb-6">
            Public Record · Anyone Can Verify
          </p>
          <h1 className="serif text-bone text-5xl md:text-6xl font-light leading-[1.05]">
            The Passport.
          </h1>
        </div>

        {valid ? (
          <PassportLive manager={manager as Address} />
        ) : (
          <div className="border border-red-500/40 bg-red-500/5 p-10 text-red-300 font-mono text-sm">
            Invalid manager address.
          </div>
        )}
      </section>

      <footer className="relative z-10 border-t border-gold/10 px-8 md:px-16 py-7 text-[10px] tracking-[0.32em] uppercase text-stone/50 flex flex-col md:flex-row gap-3 md:justify-between">
        <span>FHOX · v0.1 · Fhenix Nitrogen</span>
        <span>Agora Agents · Canteen × Circle × Arc</span>
      </footer>
    </main>
  );
}
