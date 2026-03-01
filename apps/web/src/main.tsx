import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, useAccount, useReadContract } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const queryClient = new QueryClient();

const config = createConfig({
chains: [arbitrumSepolia],
connectors: [injected()],
transports: {
[arbitrumSepolia.id]: http()
}
});

const escrowFactoryAbi = [
{
type: "function",
name: "nextEscrowId",
stateMutability: "view",
inputs: [],
outputs: [{ name: "", type: "uint256" }]
}
] as const;

function Panel() {
const { address, isConnected } = useAccount();
const factory = (import.meta as any).env?.VITE_ESCROW_FACTORY || "";

const { data, isLoading, error } = useReadContract({
address: factory ? (factory as `0x${string}`) : undefined,
abi: escrowFactoryAbi,
functionName: "nextEscrowId",
query: { enabled: !!factory }
});

return (
<main style={{ maxWidth: 760, margin: "32px auto", fontFamily: "sans-serif" }}>
<h1>DGP-P2P Web (Phase 8)</h1>
<p>钱包状态：{isConnected ? `已连接 ${address}` : "未连接（请用浏览器钱包连接）"}</p>
<p>EscrowFactory: {factory || "未配置 VITE_ESCROW_FACTORY"}</p>
<p>nextEscrowId: {isLoading ? "读取中..." : error ? "读取失败" : String(data ?? "-")}</p>
</main>
);
}

function App() {
return (
<WagmiProvider config={config}>
<QueryClientProvider client={queryClient}>
<Panel />
</QueryClientProvider>
</WagmiProvider>
);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
