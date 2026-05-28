"use client";

import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-obsidian">
      {/* atmospheric glows */}
      <div
        aria-hidden
        className="absolute -left-[10%] top-[15%] w-[55%] h-[65%] rounded-full blur-[140px] animate-drift-gold"
        style={{
          background:
            "radial-gradient(closest-side, rgba(200,164,93,0.42), rgba(200,164,93,0.10) 55%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-[8%] bottom-[5%] w-[55%] h-[70%] rounded-full blur-[150px] animate-drift-blue"
        style={{
          background:
            "radial-gradient(closest-side, rgba(77,140,255,0.32), rgba(77,140,255,0.08) 55%, transparent 75%)",
        }}
      />

      {/* vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(5,5,5,0.65) 85%, #050505 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-40 pb-24">
        {/* anchor dot + line above logo */}
        <div className="flex flex-col items-center" style={{ animation: "fadeIn 1.6s ease-out both" }}>
          <span className="block w-[6px] h-[6px] rounded-full bg-gold/80 animate-seal-pulse" />
          <span className="block w-px h-10 bg-gradient-to-b from-gold/70 to-gold/0" />
        </div>

        {/* vessel mark */}
        <div
          className="relative w-[200px] h-[260px] md:w-[240px] md:h-[310px]"
          style={{ animation: "fadeUp 1.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
        >
          <Image
            src="/corpus-logo.png"
            alt="CORPUS"
            fill
            sizes="(min-width: 768px) 240px, 200px"
            className="object-contain"
            priority
          />
          {/* gold inner spine highlight */}
          <span
            aria-hidden
            className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent"
          />
        </div>

        {/* anchor line + dot below */}
        <div className="flex flex-col items-center" style={{ animation: "fadeIn 1.6s ease-out 0.2s both" }}>
          <span className="block w-px h-10 bg-gradient-to-b from-gold/0 to-gold/70" />
          <span className="block w-[6px] h-[6px] rounded-full bg-gold/80 animate-seal-pulse" />
        </div>

        {/* wordmark */}
        <h1
          className="serif text-bone text-5xl md:text-7xl font-light tracking-[0.32em] mt-10 pl-[0.32em]"
          style={{ animation: "fadeUp 1.4s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}
        >
          CORPUS
        </h1>

        <span
          className="block w-12 h-px bg-gold/70 mt-7"
          style={{ animation: "fadeIn 1s ease-out 0.6s both" }}
        />

        <p
          className="mt-6 text-[11px] md:text-[12px] tracking-[0.48em] uppercase text-gold/90 font-light"
          style={{ animation: "fadeUp 1.2s cubic-bezier(0.16,1,0.3,1) 0.7s both" }}
        >
          The Legal Body for AI Agents
        </p>

        {/* headline */}
        <h2
          className="serif text-bone text-4xl md:text-6xl font-light italic-light mt-24 md:mt-28 text-center leading-[1.05]"
          style={{ animation: "fadeUp 1.4s cubic-bezier(0.16,1,0.3,1) 0.9s both" }}
        >
          Give your agent a body<span className="text-gold">.</span>
        </h2>

        <p
          className="mt-7 text-stone text-base md:text-[17px] max-w-xl text-center leading-relaxed font-light"
          style={{ animation: "fadeUp 1.4s cubic-bezier(0.16,1,0.3,1) 1.05s both" }}
        >
          <span className="text-bone tracking-[0.18em] text-[13px]">CORPUS</span>{" "}
          provides AI agents with a legal identity that
          <br className="hidden md:block" />
          exists, acts, and endures in the real world.
        </p>

        <Link
          href="/form"
          className="group mt-12 inline-flex items-center gap-6 border border-gold/60 hover:border-gold hover:bg-gold/[0.04] px-9 py-4 transition-all"
          style={{ animation: "fadeUp 1.4s cubic-bezier(0.16,1,0.3,1) 1.2s both" }}
        >
          <span className="text-[11px] tracking-[0.42em] uppercase text-gold">
            Request Access
          </span>
          <span className="text-gold text-lg group-hover:translate-x-1 transition-transform">→</span>
        </Link>

        {/* scroll cue */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
          style={{ animation: "fadeIn 2s ease-out 1.8s both" }}
        >
          <span className="text-[9px] tracking-[0.48em] uppercase text-stone/60">Scroll</span>
          <span className="block w-px h-8 bg-gradient-to-b from-stone/50 to-transparent" />
        </div>
      </div>
    </section>
  );
}
