import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAddress } from "viem";
import {
WagmiProvider, createConfig, http,
useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract
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
{ type: "function", name: "nextEscrowId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
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
outputs: [{ type: "uint256" }, { type: "address" }]
}
] as const;

const disputeAbi = [
{
type: "function",
name: "openDispute",
stateMutability: "nonpayable",
inputs: [{ name: "escrow", type: "address" }],
outputs: [{ type: "uint256" }]
},
{
type: "function",
name: "vote",
stateMutability: "nonpayable",
inputs: [
{ name: "disputeId", type: "uint256" },
{ name: "sellerBps", type: "uint16" }
],
outputs: []
},
{
type: "function",
name: "getDispute",
stateMutability: "view",
inputs: [{ name: "disputeId", type: "uint256" }],
outputs: [
{ name: "escrow", type: "address" },
{ name: "resolved", type: "bool" },
{ name: "sellerBps", type: "uint16" },
{ name: "votes", type: "uint16" }
]
}
] as const;

function Panel() {
const { address, isConnected } = useAccount();
const { writeContractAsync, isPending } = useWriteContract();

const factory = (import.meta as any).env?.VITE_ESCROW_FACTORY || "";
const dispute = (import.meta as any).env?.VITE_DISPUTE_MODULE || "";

const [seller, setSeller] = useState("");
const [token, setToken] = useState("");
const [amount, setAmount] = useState("1000000");
const [timeoutAt, setTimeoutAt] = useState(String(Math.floor(Date.now() / 1000) + 3600));
const [cid, setCid] = useState("ipfs://demo");
const [txHash, setTxHash] = useState("");

const [escrowAddrForDispute, setEscrowAddrForDispute] = useState("");
const [disputeId, setDisputeId] = useState("1");
const [voteDisputeId, setVoteDisputeId] = useState("1");
const [sellerBps, setSellerBps] = useState("7000");
const [formError, setFormError] = useState("");

const txReceipt = useWaitForTransactionReceipt({
hash: txHash ? (txHash as `0x${string}`) : undefined,
query: { enabled: !!txHash }
});

const nextEscrow = useReadContract({
address: factory ? (factory as `0x${string}`) : undefined,
abi: escrowFactoryAbi,
functionName: "nextEscrowId",
query: { enabled: !!factory }
});

const disputeInfo = useReadContract({
address: dispute ? (dispute as `0x${string}`) : undefined,
abi: disputeAbi,
functionName: "getDispute",
args: [BigInt(disputeId || "1")],
query: { enabled: !!dispute }
});

const parseUint = (v: string): bigint | null => {
if (!/^\d+$/.test(v.trim())) return null;
try {
return BigInt(v);
} catch {
return null;
}
};

async function onCreate() {
if (!factory) return alert("请先配置 VITE_ESCROW_FACTORY");
if (!isConnected) return alert("请先连接钱包");
const parsedAmount = parseUint(amount);
const parsedTimeout = parseUint(timeoutAt);
if (!isAddress(seller)) return setFormError("seller 地址无效");
if (!isAddress(token)) return setFormError("token 地址无效");
if (parsedAmount === null || parsedAmount <= 0n) return setFormError("amount 必须是大于 0 的整数");
if (parsedTimeout === null || parsedTimeout <= BigInt(Math.floor(Date.now() / 1000))) {
return setFormError("timeoutAt 必须晚于当前时间");
}
if (!cid.trim()) return setFormError("evidence CID 不能为空");
setFormError("");
const hash = await writeContractAsync({
address: factory as `0x${string}`,
abi: escrowFactoryAbi,
functionName: "createEscrow",
args: [seller as `0x${string}`, token as `0x${string}`, parsedAmount, parsedTimeout, cid]
});
setTxHash(hash);
setTimeout(() => nextEscrow.refetch(), 3000);
}

async function onOpenDispute() {
if (!dispute) return alert("请先配置 VITE_DISPUTE_MODULE");
const hash = await writeContractAsync({
address: dispute as `0x${string}`,
abi: disputeAbi,
functionName: "openDispute",
args: [escrowAddrForDispute as `0x${string}`]
});
setTxHash(hash);
setTimeout(() => disputeInfo.refetch(), 3000);
}

async function onVote() {
if (!dispute) return alert("请先配置 VITE_DISPUTE_MODULE");
const voteBps = Number(sellerBps);
if (Number.isNaN(voteBps) || voteBps < 0 || voteBps > 10000) {
return alert("sellerBps 必须在 0~10000");
}
const hash = await writeContractAsync({
address: dispute as `0x${string}`,
abi: disputeAbi,
functionName: "vote",
args: [BigInt(voteDisputeId || "1"), voteBps]
});
setTxHash(hash);
setDisputeId(voteDisputeId || "1");
setTimeout(() => disputeInfo.refetch(), 3000);
}

const disputeSummary = disputeInfo.data
? {
escrow: disputeInfo.data[0],
resolved: disputeInfo.data[1] ? "已裁决" : "处理中",
sellerBps: Number(disputeInfo.data[2]),
votes: Number(disputeInfo.data[3])
}
: null;

const parsedAmount = parseUint(amount);
const parsedTimeout = parseUint(timeoutAt);

const createDisabled =
isPending ||
!isConnected ||
!factory ||
!isAddress(seller) ||
!isAddress(token) ||
parsedAmount === null ||
parsedAmount <= 0n ||
parsedTimeout === null ||
parsedTimeout <= BigInt(Math.floor(Date.now() / 1000)) ||
!cid.trim();

return (
<main style={{ maxWidth: 860, margin: "24px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
<h1>DGP-P2P Web (Phase 9)</h1>
<p>钱包：{isConnected ? `已连接 ${address}` : "未连接"}</p>
<p>Factory: {factory || "未配置"}</p>
<p>Dispute: {dispute || "未配置"}</p>
<p>nextEscrowId: {nextEscrow.isLoading ? "读取中..." : String(nextEscrow.data ?? "-")}</p>

<hr />
<h3>Create Escrow</h3>
<input placeholder="seller 0x..." value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="token 0x..." value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="timeoutAt(unix)" value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="evidence CID" value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onCreate} disabled={createDisabled}>{isPending ? "发送中..." : "创建 Escrow"}</button>
{formError && <p style={{ color: "#c1121f" }}>{formError}</p>}

<hr />
<h3>Open Dispute</h3>
<input placeholder="escrow address 0x..." value={escrowAddrForDispute} onChange={(e) => setEscrowAddrForDispute(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onOpenDispute} disabled={isPending}>{isPending ? "发送中..." : "发起争议"}</button>

<hr />
<h3>Vote Dispute</h3>
<input placeholder="disputeId" value={voteDisputeId} onChange={(e) => setVoteDisputeId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="sellerBps (0~10000)" value={sellerBps} onChange={(e) => setSellerBps(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onVote} disabled={isPending}>{isPending ? "发送中..." : "提交投票"}</button>

<hr />
<h3>Query Dispute</h3>
<input placeholder="disputeId" value={disputeId} onChange={(e) => setDisputeId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={() => disputeInfo.refetch()}>刷新争议状态</button>
<pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(disputeSummary, null, 2)}
</pre>

{txHash && <p>Tx: {txHash}</p>}
{txHash && <p>Tx Status: {txReceipt.isLoading ? "确认中..." : txReceipt.isSuccess ? "已上链" : txReceipt.isError ? "失败" : "等待提交"}</p>}
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
