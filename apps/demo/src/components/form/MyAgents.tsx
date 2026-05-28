"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authenticatePasskey, passkeysSupported } from "@/lib/passkey";
import {
  agentsForCredential,
  knownCredentials,
  loadAgents,
  type StoredAgent,
} from "@/lib/agentStore";

export function MyAgents() {
  const [hasRecords, setHasRecords] = useState(false);
  const [unlocked, setUnlocked] = useState<StoredAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(passkeysSupported());
    setHasRecords(loadAgents().length > 0);
  }, []);

  const unlock = async () => {
    setError(null);
    setAuthing(true);
    try {
      const creds = knownCredentials();
      if (creds.length === 0) {
        setError("No passkeys are bound to agents in this browser.");
        setAuthing(false);
        return;
      }
      const { id } = await authenticatePasskey(creds);
      const agents = agentsForCredential(id);
      if (agents.length === 0) {
        setError("Passkey verified, but no agents are linked to it.");
      } else {
        setUnlocked(agents);
      }
    } catch (e) {
      const err = e as Record<string, unknown>;
      setError((err?.message as string) || "Sign-in failed.");
    } finally {
      setAuthing(false);
    }
  };

  if (!hasRecords) return null;

  return (
    <section className="border border-gold/15 bg-oxblood/20 backdrop-blur-sm p-8 md:p-10">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[0.48em] uppercase text-gold/80 mb-3">Recall</p>
          <h3 className="serif text-bone text-2xl md:text-3xl font-light">
            Sign in with your passkey
          </h3>
          <p className="text-stone text-[13px] mt-3 max-w-md font-light leading-relaxed">
            Your device key signs a challenge that the server verifies against the P-256 public
            key bound to this browser. Unlocks the local list of entities you&apos;ve formed.
          </p>
        </div>
        {!unlocked && supported && (
          <button
            onClick={unlock}
            disabled={authing}
            className="inline-flex items-center gap-4 border border-gold/60 hover:border-gold hover:bg-gold/5 disabled:opacity-50 px-7 py-3 transition-all"
          >
            <PasskeyIcon />
            <span className="text-[11px] tracking-[0.42em] uppercase text-gold">
              {authing ? "Verifying…" : "Unlock"}
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 border border-red-500/40 bg-red-500/5 text-red-300 text-[12px] font-mono">
          {error}
        </div>
      )}

      {unlocked && unlocked.length > 0 && (
        <div className="mt-10 space-y-px bg-gold/10">
          {unlocked.map((a) => (
            <Link
              key={a.manager}
              href={`/passport/${a.manager}`}
              className="block bg-obsidian/80 hover:bg-gold/[0.04] px-6 py-5 transition-colors group"
            >
              <div className="flex items-center justify-between gap-6">
                <div>
                  <div className="serif text-bone text-xl font-light group-hover:text-gold transition-colors">
                    {a.legalName}
                  </div>
                  <div className="text-[10px] tracking-[0.32em] uppercase text-stone/70 mt-1.5 font-mono">
                    {a.manager.slice(0, 10)}…{a.manager.slice(-6)} · #{a.tokenId}
                  </div>
                </div>
                <span className="text-gold opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PasskeyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="text-gold"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19c0-3.3 2.7-6 6-6h.5" />
      <path d="M14 13l6 6" />
      <path d="M17 13l-1.5 1.5" />
      <path d="M14 16l-1.5 1.5" />
    </svg>
  );
}
