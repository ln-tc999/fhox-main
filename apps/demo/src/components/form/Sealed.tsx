"use client";

import { useEffect } from "react";
import type { Address } from "viem";
import confetti from "canvas-confetti";
import { PassportCard } from "./PassportCard";
import { ProfileCard } from "./ProfileCard";

export function Sealed({
  manager,
  tokenId,
  legalName,
}: {
  manager: Address;
  tokenId: bigint;
  legalName: string;
}) {
  useEffect(() => {
    const fire = (opts: confetti.Options) =>
      confetti({
        spread: 80,
        startVelocity: 45,
        ticks: 220,
        gravity: 0.9,
        scalar: 1.05,
        ...opts,
      });

    const goldA = ["#c8a45d", "#e1c889", "#a8843e"];
    const goldB = ["#f4efe7", "#c8a45d", "#fff1cf"];

    fire({ particleCount: 80, angle: 60, origin: { x: 0, y: 0.2 }, colors: goldA });
    fire({ particleCount: 80, angle: 120, origin: { x: 1, y: 0.2 }, colors: goldA });
    setTimeout(
      () => fire({ particleCount: 50, angle: 90, origin: { x: 0.5, y: 0 }, colors: goldB }),
      220,
    );
    setTimeout(
      () =>
        fire({
          particleCount: 40,
          angle: 90,
          spread: 110,
          origin: { x: 0.5, y: 0 },
          colors: goldB,
        }),
      540,
    );
  }, [manager]);

  const handle = `${manager.slice(0, 6)}…${manager.slice(-4)}`;

  return (
    <div className="space-y-14">
      <div>
        <p className="text-[11px] tracking-[0.48em] uppercase text-verified mb-6 flex items-center gap-3">
          <span className="block w-1.5 h-1.5 rounded-full bg-verified animate-seal-pulse" />
          Entity Sealed · Live on Arc
        </p>
        <h2 className="serif text-bone text-4xl md:text-5xl font-light leading-[1.05] mb-3">
          Your agent has a body<span className="text-gold">.</span>
        </h2>
        <p className="text-stone text-[15px] font-light max-w-2xl">
          The manager contract is deployed, the ERC-8004 identity is minted, and the operating
          policy is enforced on-chain.
        </p>
      </div>

      <div className="flex justify-center" style={{ animation: "fadeUp 1.2s cubic-bezier(0.16,1,0.3,1) both" }}>
        <ProfileCard
          avatarUrl="/fhox-logo.png"
          miniAvatarUrl="/fhox-logo.png"
          rubric="FHOX Passport"
          name={legalName}
          title={`erc-8004 · #${tokenId.toString()}`}
          handle={handle}
          status="Active · On-Chain"
          contactText="Open Passport"
          contactHref={`/passport/${manager}`}
          behindGlowColor="rgba(200, 164, 93, 0.55)"
          behindGlowSize="40%"
          enableTilt
        />
      </div>

      <PassportCard manager={manager} tokenId={tokenId} legalName={legalName} />
    </div>
  );
}
