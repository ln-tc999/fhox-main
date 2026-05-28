"use client";

import Image from "next/image";
import Link from "next/link";

const NAV = [
  { label: "Platform", href: "#platform" },
  { label: "Solutions", href: "#solutions" },
  { label: "Resources", href: "#resources" },
  { label: "Company", href: "#company" },
];

export function MarketingHeader() {
  return (
    <header className="absolute top-0 inset-x-0 z-30 px-10 lg:px-16 py-7 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3 group">
        <span className="relative w-7 h-9">
          <Image
            src="/corpus-logo.png"
            alt=""
            fill
            sizes="28px"
            className="object-contain opacity-90 group-hover:opacity-100 transition"
            priority
          />
        </span>
        <span className="serif text-bone text-xl tracking-[0.42em] font-light">
          CORPUS
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-12">
        {NAV.map((n) => (
          <a
            key={n.label}
            href={n.href}
            className="text-[11px] tracking-[0.32em] text-gold/90 hover:text-gold uppercase font-light transition-colors"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <Link
        href="/form"
        className="text-[11px] tracking-[0.32em] uppercase text-gold border border-gold/60 hover:border-gold hover:bg-gold/5 px-6 py-3 transition-all"
      >
        Request Access
      </Link>
    </header>
  );
}
