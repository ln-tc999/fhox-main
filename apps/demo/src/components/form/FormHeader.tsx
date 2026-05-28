"use client";

import Image from "next/image";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { fhenixNitrogen } from "@fhox/sdk";

export function FormHeader() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const injected = connectors.find((c) => c.id === "injected");
  const wrongChain = isConnected && chainId !== fhenixNitrogen.id;

  const switchToArc = async () => {
    try {
      await switchChain({ chainId: fhenixNitrogen.id });
    } catch {
      try {
        const provider = (await connector?.getProvider()) as
          | { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }
          | undefined;
        if (!provider) return;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x4cef52",
              chainName: "Fhenix Nitrogen",
              nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
              rpcUrls: ["https://api.nitrogen.fhenix.zone"],
              blockExplorerUrls: ["https://explorer.nitrogen.fhenix.zone"],
            },
          ],
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <header className="relative z-30 px-8 md:px-16 py-7 flex items-center justify-between border-b border-gold/10">
      <Link href="/" className="flex items-center gap-3 group">
        <span className="relative w-7 h-9">
          <Image
            src="/fhox-logo.png"
            alt=""
            fill
            sizes="28px"
            className="object-contain opacity-90 group-hover:opacity-100 transition"
            priority
          />
        </span>
        <span className="serif text-bone text-xl tracking-[0.42em] font-light">CORPUS</span>
        <span className="hidden md:inline-block text-[10px] tracking-[0.32em] uppercase text-gold/60 ml-3 pl-3 border-l border-gold/20">
          Formation
        </span>
      </Link>

      <div className="text-sm">
        {!isConnected ? (
          <button
            className="text-[11px] tracking-[0.32em] uppercase text-gold border border-gold/60 hover:border-gold hover:bg-gold/5 px-6 py-3 transition-all"
            onClick={() => injected && connect({ connector: injected })}
          >
            Connect Wallet
          </button>
        ) : wrongChain ? (
          <button
            className="text-[11px] tracking-[0.32em] uppercase text-red-300 border border-red-500/60 hover:bg-red-500/10 px-6 py-3 transition-all"
            onClick={switchToArc}
          >
            Switch to Fhenix Nitrogen
          </button>
        ) : (
          <div className="flex items-center gap-5 font-mono text-[11px]">
            <span className="flex items-center gap-2 text-bone">
              <span className="block w-1.5 h-1.5 rounded-full bg-verified animate-seal-pulse" />
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </span>
            <button
              className="text-[10px] tracking-[0.32em] uppercase text-stone hover:text-bone transition-colors"
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
