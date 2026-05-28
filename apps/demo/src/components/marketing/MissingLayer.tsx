"use client";

import { Reveal } from "./Reveal";

const MISSING = [
  { n: "01", k: "Counterparty", v: "An agent cannot legally sign on its own behalf." },
  { n: "02", k: "Mandate", v: "There is no operating agreement defining what it may do." },
  { n: "03", k: "Record", v: "Its decisions vanish. There is no durable audit." },
  { n: "04", k: "Treasury", v: "Funds move through humans, not the agent itself." },
  { n: "05", k: "Recourse", v: "When a contract fails, there is nothing to enforce against." },
];

export function MissingLayer() {
  return (
    <section className="relative bg-obsidian py-32 md:py-44 px-6 md:px-16 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(#F4EFE7 1px, transparent 1px), linear-gradient(90deg, #F4EFE7 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-8">
            § I · The Missing Layer
          </p>
        </Reveal>

        <Reveal delay={120}>
          <h3 className="serif text-bone text-4xl md:text-6xl font-light leading-[1.08] max-w-4xl">
            Agents have wallets.
            <br />
            <span className="text-stone italic">They still lack standing.</span>
          </h3>
        </Reveal>

        <Reveal delay={240}>
          <div className="gold-rule mt-16 mb-16 max-w-md" />
        </Reveal>

        <div className="grid md:grid-cols-2 gap-x-20 gap-y-12 md:gap-y-16">
          {MISSING.map((item, i) => (
            <Reveal key={item.n} delay={120 * i}>
              <div className="flex gap-6 border-l border-gold/15 pl-6 hover:border-gold/60 transition-colors">
                <span className="serif text-gold/70 text-2xl font-light">{item.n}</span>
                <div>
                  <h4 className="serif text-bone text-2xl md:text-3xl font-light mb-3">
                    {item.k}
                  </h4>
                  <p className="text-stone leading-relaxed text-[15px] font-light">{item.v}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
