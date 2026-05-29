"use client";

import { useEffect, useState } from "react";
import {
  keccak256,
  toHex,
  type Address,
  type Hex,
  createWalletClient,
  createPublicClient,
  custom,
  http,
} from "viem";
import { useAccount, useChainId } from "wagmi";
import { FhoxClient, arbitrumSepolia } from "@fhox/sdk";
import { registerPasskey, passkeysSupported } from "@/lib/passkey";
import { saveAgent } from "@/lib/agentStore";

type Step = 1 | 2 | 3 | 4;

const FACTORY = (process.env.NEXT_PUBLIC_FHOX_FACTORY ?? "") as Address;

const STEPS: { n: string; label: string }[] = [
  { n: "I", label: "Entity" },
  { n: "II", label: "Policy" },
  { n: "III", label: "Mediator" },
  { n: "IV", label: "Review" },
];

export function FormationWizard({
  onFormed,
}: {
  onFormed: (manager: Address, tokenId: bigint, legalName: string) => void;
}) {
  const { address, connector } = useAccount();
  const chainId = useChainId();

  const [step, setStep] = useState<Step>(1);
  const [legalName, setLegalName] = useState("Loom Trading DAO LLC");
  const [dailyCap, setDailyCap] = useState("1000");
  const [allowlistOnly, setAllowlistOnly] = useState(false);
  const [mediator, setMediator] = useState("");
  const [registerPasskeyOnForm, setRegisterPasskeyOnForm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nameCheck, setNameCheck] = useState<{
    checking: boolean;
    taken: boolean;
    existing: Address | null;
  }>({ checking: false, taken: false, existing: null });

  const factoryReady =
    FACTORY !== "0x0000000000000000000000000000000000000000" && FACTORY.length === 42;

  // Pre-flight name check whenever the user lands on Review and the name is non-empty.
  // Lets us warn before a doomed `NameAlreadyTaken` revert.
  useEffect(() => {
    if (step !== 4 || !factoryReady) return;
    const trimmed = legalName.trim();
    if (!trimmed) return;
    let cancelled = false;
    setNameCheck((s) => ({ ...s, checking: true }));
    (async () => {
      try {
        const publicClient = createPublicClient({
          chain: arbitrumSepolia,
          transport: http(process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? "/api/rpc"),
        });
        const client = new FhoxClient({
          publicClient,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walletClient: {} as any, // read-only — walletClient unused for view calls
          factory: FACTORY,
        });
        const result = await client.isNameTaken(trimmed);
        if (cancelled) return;
        setNameCheck({
          checking: false,
          taken: result.taken,
          existing: result.taken ? result.existingManager : null,
        });
      } catch (e) {
        console.warn("[fhox] name check failed", e);
        if (!cancelled) setNameCheck({ checking: false, taken: false, existing: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, legalName, factoryReady]);

  const submit = async () => {
    if (!address) return setError("Wallet not connected.");
    if (!connector) return setError("No connector.");
    if (!factoryReady) {
      return setError("NEXT_PUBLIC_FHOX_FACTORY is not set. Deploy the factory first.");
    }
    setSubmitting(true);
    setError(null);

    try {
      setPhase("Building clients");
      const provider = await connector.getProvider();
      const walletClient = createWalletClient({
        account: address,
        chain: arbitrumSepolia,
        // @ts-expect-error — EIP-1193 provider
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(process.env.NEXT_PUBLIC_FHENIX_RPC_URL ?? "/api/rpc"),
      });
      if (chainId !== arbitrumSepolia.id) {
        throw new Error(`Wrong chain (${chainId}). Switch wallet to Arbitrum Sepolia (421614).`);
      }

      const client = new FhoxClient({ publicClient, walletClient, factory: FACTORY });

      setPhase("Encrypting policy (FHE)");
      const capUsdc = BigInt(Math.floor(Number(dailyCap) * 1_000_000));
      const hasDailyCap = capUsdc > 0n;

      setPhase("Awaiting signature");
      const result = await client.form({
        metadata: {
          legalName,
          jurisdiction: "WY",
          filingId: "",
          articlesHash: keccak256(toHex(`articles:${legalName}`)) as Hex,
          operatingAgreementHash: keccak256(toHex(`oa:${legalName}`)) as Hex,
          formedAt: 0n,
        },
        dailyCapUsdc: capUsdc,
        hasDailyCap,
        allowlistOnly,
        principal: address,
        mediator: (mediator || address) as Address,
        identityMetadataURI: `data:application/json,${encodeURIComponent(
          JSON.stringify({ name: legalName, jurisdiction: "WY", protocol: "fhox-v0.1" }),
        )}`,
      });

      setPhase("Registering passkey");
      let credentialId = "";
      let credentialPublicKey = "";
      if (registerPasskeyOnForm && passkeysSupported()) {
        try {
          const cred = await registerPasskey({
            walletAddress: address,
            displayName: legalName,
          });
          credentialId = cred.id;
          credentialPublicKey = cred.publicKey;
        } catch (passkeyErr) {
          console.warn("[fhox] passkey registration skipped", passkeyErr);
        }
      }

      saveAgent({
        manager: result.manager,
        tokenId: result.identityTokenId.toString(),
        legalName,
        jurisdiction: "WY",
        principal: address,
        formedAt: Date.now(),
        credentialId,
        credentialPublicKey,
      });

      onFormed(result.manager, result.identityTokenId, legalName);
    } catch (e) {
      console.error("[fhox] form failed", e);
      const err = e as Record<string, unknown>;
      const msg =
        (typeof err?.shortMessage === "string" && err.shortMessage) ||
        (typeof err?.message === "string" && err.message) ||
        JSON.stringify(e, null, 2);
      setError(msg || "Unknown error");
    } finally {
      setSubmitting(false);
      setPhase("");
    }
  };

  return (
    <div className="relative">
      {/* corner ornaments */}
      <span className="absolute -top-px -left-px w-6 h-6 border-t border-l border-gold/60" />
      <span className="absolute -top-px -right-px w-6 h-6 border-t border-r border-gold/60" />
      <span className="absolute -bottom-px -left-px w-6 h-6 border-b border-l border-gold/60" />
      <span className="absolute -bottom-px -right-px w-6 h-6 border-b border-r border-gold/60" />

      <div className="border border-gold/20 bg-oxblood/30 backdrop-blur-sm p-10 md:p-14">
        {/* step rail */}
        <div className="flex items-center gap-0 mb-12">
          {STEPS.map((s, i) => {
            const idx = (i + 1) as Step;
            const active = idx === step;
            const past = idx < step;
            return (
              <div key={s.n} className="flex items-center flex-1">
                <button
                  onClick={() => idx < step && setStep(idx)}
                  className={`flex items-baseline gap-3 group ${idx < step ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`serif text-lg font-light tracking-widest transition-colors ${
                      active ? "text-gold" : past ? "text-bone/80" : "text-stone/40"
                    }`}
                  >
                    {s.n}
                  </span>
                  <span
                    className={`text-[10px] tracking-[0.32em] uppercase transition-colors ${
                      active ? "text-bone" : past ? "text-stone" : "text-stone/40"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span
                    className={`flex-1 mx-5 h-px transition-colors ${
                      past ? "bg-gold/50" : "bg-gold/10"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <Field
            label="Legal name of the entity"
            hint="Appears on Articles of Organization, the on-chain identity record, and every contract this agent signs."
          >
            <input
              autoFocus
              className="input"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </Field>
        )}

        {step === 2 && (
          <div className="space-y-10">
            <Field
              label="Daily USDC spend cap"
              hint="Enforced by the manager contract at every payment. Set 0 for no cap."
            >
              <input
                className="input"
                type="number"
                min="0"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-4 cursor-pointer group">
              <span
                className={`relative w-5 h-5 border transition-colors ${
                  allowlistOnly ? "border-gold bg-gold/10" : "border-gold/30 group-hover:border-gold/60"
                }`}
              >
                {allowlistOnly && (
                  <span className="absolute inset-1 bg-gold block" />
                )}
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allowlistOnly}
                  onChange={(e) => setAllowlistOnly(e.target.checked)}
                />
              </span>
              <span className="text-bone text-sm font-light">
                Restrict payments to allowlisted counterparties
              </span>
            </label>
          </div>
        )}

        {step === 3 && (
          <Field
            label="Mediator address"
            hint="Authorized to resolve disputes under the Operating Agreement. Leave blank to use your own address (testing only)."
          >
            <input
              className="input"
              placeholder="0x…"
              value={mediator}
              onChange={(e) => setMediator(e.target.value)}
            />
          </Field>
        )}

        {step === 4 && (
          <div>
            <p className="text-[11px] tracking-[0.48em] uppercase text-gold/80 mb-6">
              Articles · For Review
            </p>
            <div className="font-mono text-[12px] space-y-0">
              <Row k="legal_name" v={legalName} />
              <Row k="jurisdiction" v="Wyoming" />
              <Row k="entity_type" v="DAO LLC · W.S. 17-31-115" />
              <Row k="daily_cap_usdc" v={`${Number(dailyCap).toLocaleString()} USDC`} />
              <Row k="allowlist_only" v={String(allowlistOnly)} />
              <Row k="principal" v={address ?? "—"} mono />
              <Row k="mediator" v={mediator || address || "—"} mono />
              <Row k="privacy" v="FHE-encrypted · CoFHE" />
              <Row k="identity" v="ERC-8004 · Arbitrum Sepolia" />
            </div>

            {passkeysSupported() && (
              <label className="flex items-start gap-4 cursor-pointer group mt-10 pt-8 border-t border-gold/15">
                <span
                  className={`relative w-5 h-5 mt-0.5 border transition-colors flex-shrink-0 ${
                    registerPasskeyOnForm
                      ? "border-gold bg-gold/10"
                      : "border-gold/30 group-hover:border-gold/60"
                  }`}
                >
                  {registerPasskeyOnForm && <span className="absolute inset-1 bg-gold block" />}
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={registerPasskeyOnForm}
                    onChange={(e) => setRegisterPasskeyOnForm(e.target.checked)}
                  />
                </span>
                <span>
                  <span className="text-bone text-sm font-light">
                    Register a passkey to unlock this entity later
                  </span>
                  <span className="block text-stone/80 text-[12px] font-light mt-1.5 leading-relaxed max-w-md">
                    Your device key gates a local record of agents you&apos;ve formed in this browser.
                    The entity itself remains owned on-chain by your wallet.
                  </span>
                </span>
              </label>
            )}

            {nameCheck.checking && (
              <div className="mt-8 px-4 py-3 border border-gold/20 bg-gold/[0.03] text-gold/80 text-[11px] tracking-[0.32em] uppercase font-light flex items-center gap-3">
                <span className="block w-1.5 h-1.5 rounded-full bg-gold/70 animate-seal-pulse" />
                Checking name registry…
              </div>
            )}

            {nameCheck.taken && nameCheck.existing && (
              <div className="mt-8 px-5 py-4 border border-red-500/50 bg-red-500/[0.06]">
                <p className="text-[10px] tracking-[0.42em] uppercase text-red-300 mb-2">
                  Name Already Taken
                </p>
                <p className="text-bone text-[13px] font-light leading-relaxed">
                  &ldquo;{legalName}&rdquo; is held by another FHOX entity.
                </p>
                <p className="text-stone text-[11px] font-mono mt-2 break-all">
                  {nameCheck.existing}
                </p>
                <p className="text-stone/80 text-[11px] font-light mt-3 leading-relaxed">
                  Names are case-insensitive on the factory. Choose a different legal name to proceed.
                </p>
              </div>
            )}

            {!factoryReady && (
              <div className="mt-8 px-4 py-3 border border-red-500/40 bg-red-500/5 text-red-300 text-[12px] font-mono">
                NEXT_PUBLIC_FHOX_FACTORY not configured. Deploy first.
              </div>
            )}
            {error && (
              <div className="mt-8 px-4 py-3 border border-red-500/40 bg-red-500/5 text-red-300 text-[12px] font-mono break-words whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-14">
          <button
            className="text-[11px] tracking-[0.32em] uppercase text-stone hover:text-bone disabled:opacity-20 disabled:hover:text-stone transition-colors"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              className="inline-flex items-center gap-5 border border-gold/60 hover:border-gold hover:bg-gold/5 px-8 py-3.5 transition-all"
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              <span className="text-[11px] tracking-[0.42em] uppercase text-gold">Continue</span>
              <span className="text-gold">→</span>
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-5 border border-gold bg-gold/10 hover:bg-gold/20 px-8 py-3.5 disabled:opacity-40 disabled:hover:bg-gold/10 transition-all"
              disabled={submitting || !address || nameCheck.taken || nameCheck.checking}
              onClick={submit}
            >
              <span className="text-[11px] tracking-[0.42em] uppercase text-gold">
                {submitting ? phase || "Forming…" : nameCheck.taken ? "Name Taken" : "Seal the Entity"}
              </span>
              <span className="text-gold">{submitting ? "◌" : nameCheck.taken ? "⊘" : "▣"}</span>
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgba(5, 5, 5, 0.5);
          border: 1px solid rgba(200, 164, 93, 0.2);
          color: #f4efe7;
          padding: 14px 18px;
          font-size: 15px;
          font-family: var(--font-cormorant), "Cormorant Garamond", serif;
          letter-spacing: 0.01em;
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        :global(.input::placeholder) {
          color: rgba(155, 148, 138, 0.5);
        }
        :global(.input:focus) {
          border-color: rgba(200, 164, 93, 0.7);
          background: rgba(5, 5, 5, 0.7);
        }
        :global(.input[type="number"]) {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.42em] uppercase text-gold/80 mb-4">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-stone/80 mt-4 leading-relaxed max-w-lg font-light">{hint}</p>}
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-6 border-b border-gold/10 py-3.5">
      <span className="text-stone/70 uppercase tracking-[0.24em] text-[10px]">{k}</span>
      <span className={`text-bone truncate text-right max-w-[420px] ${mono ? "" : ""}`}>{v}</span>
    </div>
  );
}
