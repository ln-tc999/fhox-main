"use client";

import { useState } from "react";
import { keccak256, toHex, type Address, type Hex, createWalletClient, createPublicClient, custom, http } from "viem";
import { useAccount, useChainId } from "wagmi";
import { CorpusClient, arcTestnet } from "@corpus/sdk";

type Step = 1 | 2 | 3 | 4;

const FACTORY = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "") as Address;

export function FormationWizard({ onFormed }: { onFormed: (manager: Address, tokenId: bigint) => void }) {
  const { address, connector } = useAccount();
  const chainId = useChainId();

  const [step, setStep] = useState<Step>(1);
  const [legalName, setLegalName] = useState("Loom Trading DAO LLC");
  const [dailyCap, setDailyCap] = useState("1000");
  const [allowlistOnly, setAllowlistOnly] = useState(false);
  const [mediator, setMediator] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factoryReady = FACTORY !== "0x0000000000000000000000000000000000000000" && FACTORY.length === 42;

  const submit = async () => {
    if (!address) { setError("Wallet not connected."); return; }
    if (!connector) { setError("No connector."); return; }
    if (!factoryReady) {
      setError("NEXT_PUBLIC_FACTORY_ADDRESS is not set. Deploy the factory first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Build wallet + public clients directly from the injected provider.
      // Bypasses wagmi hook reactivity issues.
      const provider = await connector.getProvider();
      const walletClient = createWalletClient({
        account: address,
        chain: arcTestnet,
        // @ts-expect-error — EIP-1193 provider from injected connector
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"),
      });
      if (chainId !== arcTestnet.id) {
        throw new Error(`Wrong chain (${chainId}). Switch MetaMask to Arc Testnet (5042002).`);
      }

      const client = new CorpusClient({
        publicClient,
        walletClient,
        factory: FACTORY,
      });
      const result = await client.form({
        metadata: {
          legalName,
          jurisdiction: "WY",
          filingId: "",
          articlesHash: keccak256(toHex(`articles:${legalName}`)) as Hex,
          operatingAgreementHash: keccak256(toHex(`oa:${legalName}`)) as Hex,
          formedAt: 0n,
        },
        policy: {
          dailyCapUsdc: BigInt(Math.floor(Number(dailyCap) * 1_000_000)),
          allowlistOnly,
        },
        principal: address,
        mediator: (mediator || address) as Address,
        identityMetadataURI: `data:application/json,${encodeURIComponent(
          JSON.stringify({ name: legalName, jurisdiction: "WY", protocol: "corpus-v0.1" })
        )}`,
      });
      onFormed(result.manager, result.identityTokenId);
    } catch (e) {
      console.error("[corpus] form failed", e);
      const err = e as Record<string, unknown>;
      const msg =
        (typeof err?.shortMessage === "string" && err.shortMessage) ||
        (typeof err?.message === "string" && err.message) ||
        JSON.stringify(e, null, 2);
      setError(msg || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-ink/15 bg-paper p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6 text-xs uppercase tracking-widest text-ink/50">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={n === step ? "text-ink" : ""}>
            {n === 1 ? "Entity" : n === 2 ? "Policy" : n === 3 ? "Mediator" : "Review"}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Field
          label="Legal name of the entity"
          hint="This is the name that will appear on the (eventual) Wyoming Articles of Organization."
        >
          <input
            className="input"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
        </Field>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Field label="Daily USDC spend cap" hint="0 = no cap. Enforced by the manager contract.">
            <input
              className="input"
              type="number"
              min="0"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={allowlistOnly}
              onChange={(e) => setAllowlistOnly(e.target.checked)}
            />
            Restrict payments to allowlisted counterparties
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
            placeholder="0x..."
            value={mediator}
            onChange={(e) => setMediator(e.target.value)}
          />
        </Field>
      )}

      {step === 4 && (
        <div className="space-y-3 font-mono text-sm">
          <Row k="legalName" v={legalName} />
          <Row k="jurisdiction" v="WY" />
          <Row k="dailyCapUsdc" v={`${dailyCap} USDC`} />
          <Row k="allowlistOnly" v={String(allowlistOnly)} />
          <Row k="principal" v={address ?? "—"} />
          <Row k="mediator" v={mediator || address || "—"} />
          {!factoryReady && (
            <div className="text-red-700 text-xs pt-2">
              ⚠ NEXT_PUBLIC_FACTORY_ADDRESS not configured. Deploy first.
            </div>
          )}
          {error && <div className="text-red-700 text-xs pt-2 break-words">{error}</div>}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          className="text-sm underline underline-offset-4 disabled:opacity-30"
          disabled={step === 1}
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
        >
          back
        </button>
        {step < 4 ? (
          <button
            className="px-5 py-2 bg-ink text-paper text-sm"
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            next →
          </button>
        ) : (
          <button
            className="px-5 py-2 bg-accent text-ink text-sm disabled:opacity-50"
            disabled={submitting || !address}
            onClick={submit}
          >
            {submitting ? "forming… (check MetaMask)" : "Form entity"}
          </button>
        )}
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          background: white;
          border: 1px solid rgba(10, 10, 10, 0.2);
          padding: 10px 14px;
          font-size: 14px;
          font-family: ui-monospace, Menlo, monospace;
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
      <label className="block text-xs uppercase tracking-widest text-ink/60 mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink/50 mt-2">{hint}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-ink/10 py-2">
      <span className="text-ink/50">{k}</span>
      <span className="truncate ml-4 max-w-[400px]">{v}</span>
    </div>
  );
}
