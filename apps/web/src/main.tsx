import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
WagmiProvider, createConfig, http,
useAccount, useReadContract, useWriteContract
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const queryClient = new QueryClient();

const config = createConfig({
chains: [arbitrumSepolia],
connectors: [injected()],
transports: { [arbitrumSepolia.id]: http() }
});

const escrowFactoryAbi = [
{
type: "function",
name: "nextEscrowId",
stateMutability: "view",
inputs: [],
outputs: [{ name: "", type: "uint256" }]
},
{
type: "function",
name: "createEscrow",
stateMutability: "nonpayable",
inputs: [
{ name: "seller", type: "address" },
{ name: "token", type: "address" },
{ name: "amount", type: "uint256" },
{ name: "timeoutAt", type: "uint64" },
{ name: "evidenceCID", type: "string" }
],
outputs: [
{ name: "escrowId", type: "uint256" },
{ name: "escrowAddr", type: "address" }
]
}
] as const;

function Panel() {
const { address, isConnected } = useAccount();
const { writeContractAsync, isPending } = useWriteContract();

const factory = (import.meta as any).env?.VITE_ESCROW_FACTORY || "";
const [seller, setSeller] = useState("");
const [token, setToken] = useState("");
const [amount, setAmount] = useState("1000000"); // USDT 6位示例
const [timeoutAt, setTimeoutAt] = useState(String(Math.floor(Date.now() / 1000) + 3600));
const [cid, setCid] = useState("ipfs://demo");
const [txHash, setTxHash] = useState("");

const { data, isLoading, error, refetch } = useReadContract({
address: factory ? (factory as `0x${string}`) : undefined,
abi: escrowFactoryAbi,
functionName: "nextEscrowId",
query: { enabled: !!factory }
});

async function onCreate() {
if (!factory) return alert("请先配置 VITE_ESCROW_FACTORY");
try {
const hash = await writeContractAsync({
address: factory as `0x${string}`,
abi: escrowFactoryAbi,
functionName: "createEscrow",
args: [seller as `0x${string}`, token as `0x${string}`, BigInt(amount), BigInt(timeoutAt), cid]
});
setTxHash(hash);
setTimeout(() => refetch(), 3000);
} catch (e) {
console.error(e);
alert("交易发送失败，请检查地址/钱包网络");
}
}

return (
<main style={{ maxWidth: 820, margin: "24px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
<h1>DGP-P2P Web (Phase 8.4)</h1>
<p>钱包状态：{isConnected ? `已连接 ${address}` : "未连接"}</p>
<p>EscrowFactory: {factory || "未配置 VITE_ESCROW_FACTORY"}</p>
<p>nextEscrowId: {isLoading ? "读取中..." : error ? "读取失败" : String(data ?? "-")}</p>

<hr />
<h3>Create Escrow</h3>
<input placeholder="seller 0x..." value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="token 0x..." value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="timeoutAt(unix)" value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="evidence CID" value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onCreate} disabled={isPending}>{isPending ? "发送中..." : "创建 Escrow"}</button>

{txHash && <p>Tx: {txHash}</p>}
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
