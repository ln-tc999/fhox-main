"use client";

import { Reveal } from "./Reveal";

const PARTNERS = [
  { name: "Arc", role: "Settlement" },
  { name: "Circle", role: "Programmable Wallets" },
  { name: "USDC", role: "Treasury" },
  { name: "ERC-8004", role: "Identity" },
  { name: "Wyoming", role: "Jurisdiction" },
  { name: "Canteen", role: "Infrastructure" },
];

export function Stack() {
  return (
    <section id="resources" className="relative bg-obsidian py-32 md:py-44 px-6 md:px-16 border-t border-gold/10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-8">
            § IV · The Stack
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h3 className="serif text-bone text-4xl md:text-6xl font-light leading-[1.08] max-w-4xl">
            Built on stablecoin-native rails
            <span className="text-gold">.</span>
          </h3>
        </Reveal>

        <div className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-px bg-gold/10">
          {PARTNERS.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <div className="bg-obsidian px-8 py-12 hover:bg-gold/[0.025] transition-colors group">
                <p className="text-[10px] tracking-[0.48em] uppercase text-stone/70 mb-3">
                  {p.role}
                </p>
                <p className="serif text-bone text-3xl md:text-4xl font-light group-hover:text-gold transition-colors">
                  {p.name}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
