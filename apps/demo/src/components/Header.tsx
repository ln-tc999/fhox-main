"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "@fhox/sdk";

export function Header() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const injected = connectors.find((c) => c.id === "injected");
  const wrongChain = isConnected && chainId !== arbitrumSepolia.id;

  const switchToFhox = async () => {
    try {
      await switchChain({ chainId: arbitrumSepolia.id });
    } catch {
      // Chain not added yet — request MetaMask to add it
      try {
        const provider = (await connector?.getProvider()) as
          | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
          | undefined;
        if (!provider) return;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x66EED",
              chainName: "Arbitrum Sepolia",
              nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
              blockExplorerUrls: ["https://sepolia.arbiscan.io"],
            },
          ],
        });
      } catch (e) {
        console.error("Failed to add Arbitrum Sepolia", e);
      }
    }
  };

  return (
    <header className="border-b border-ink/10 px-8 py-5 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <span className="serif text-2xl tracking-tight">FHOX</span>
        <span className="text-xs uppercase tracking-widest text-ink/50">
          legal bodies for agents · arbitrum sepolia
        </span>
      </div>
      <div className="text-sm">
        {!isConnected ? (
          <button
            className="px-4 py-2 bg-ink text-paper hover:bg-ink/80 transition"
            onClick={() => injected && connect({ connector: injected })}
          >
            Connect wallet
          </button>
        ) : wrongChain ? (
          <button
            className="px-4 py-2 bg-red-700 text-white hover:bg-red-800 transition"
            onClick={switchToFhox}
          >
            Switch to Arbitrum Sepolia
          </button>
        ) : (
          <div className="flex items-center gap-4 font-mono text-xs">
            <span>{address?.slice(0, 6)}…{address?.slice(-4)}</span>
            <button className="underline underline-offset-4" onClick={() => disconnect()}>
              disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
