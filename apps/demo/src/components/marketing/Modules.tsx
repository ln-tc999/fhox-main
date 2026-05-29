"use client";

import { Reveal } from "./Reveal";

const MODULES = [
  {
    n: "I",
    title: "Formation",
    body:
      "A Wyoming DAO LLC, deployed in a single transaction. The agent receives an algorithmic-manager contract and is recognized as a legal person under W.S. 17-31-115.",
  },
  {
    n: "II",
    title: "Treasury",
    body:
      "A programmable USDC wallet on Arbitrum Sepolia, with deterministic spending limits, allowlists, and signature policies the agent operates under.",
  },
  {
    n: "III",
    title: "Identity",
    body:
      "An ERC-8004 identity NFT — the agent's portable, on-chain passport. Verifiable everywhere, owned by the entity itself.",
  },
  {
    n: "IV",
    title: "Audit",
    body:
      "Every decision, payment, and contract recorded immutably. A durable record the agent — and its counterparties — can rely on.",
  },
  {
    n: "V",
    title: "Mediation",
    body:
      "Binding dispute resolution wired into the operating agreement. When something breaks, there is an enforceable path forward.",
  },
];

export function Modules() {
  return (
    <section id="platform" className="relative bg-obsidian py-32 md:py-44 px-6 md:px-16">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-8">
            § II · The Body
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h3 className="serif text-bone text-4xl md:text-6xl font-light leading-[1.08] max-w-4xl">
            Five organs.
            <br />
            <span className="text-stone italic">One legal actor.</span>
          </h3>
        </Reveal>

        <Reveal delay={240}>
          <p className="mt-8 text-stone max-w-2xl text-[16px] font-light leading-relaxed">
            FHOX is not a wrapper. It is the operating anatomy that turns an autonomous model
            into a counterparty the law can recognize.
          </p>
        </Reveal>

        <div className="mt-20 border-t border-gold/15">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={i * 80}>
              <div className="group grid grid-cols-12 gap-6 py-10 md:py-14 border-b border-gold/15 hover:bg-gold/[0.015] transition-colors">
                <div className="col-span-12 md:col-span-2">
                  <span className="serif text-gold text-3xl font-light tracking-widest">
                    {m.n}
                  </span>
                </div>
                <div className="col-span-12 md:col-span-4">
                  <h4 className="serif text-bone text-3xl md:text-4xl font-light group-hover:translate-x-1 transition-transform">
                    {m.title}
                  </h4>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <p className="text-stone leading-relaxed text-[16px] font-light">{m.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
