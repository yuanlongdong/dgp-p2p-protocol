import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider, createConfig, http,
  useAccount, useConnect, useDisconnect, useReadContract,
  useSwitchChain, useWaitForTransactionReceipt, useWriteContract
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { isAddress } from "viem";

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

const escrowAbi = [
{
type: "function",
name: "fund",
stateMutability: "nonpayable",
inputs: [],
outputs: []
},
{
type: "function",
name: "releaseToSeller",
stateMutability: "nonpayable",
inputs: [],
outputs: []
},
{
type: "function",
name: "markDispute",
stateMutability: "nonpayable",
inputs: [{ name: "cid", type: "string" }],
outputs: []
}
] as const;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <main style={{ maxWidth: 860, margin: "24px auto", fontFamily: "sans-serif" }}>页面异常，请刷新重试。</main>;
    }
    return this.props.children;
  }
}

function Panel() {
const { address, isConnected, chainId } = useAccount();
const { connect, connectors, isPending: connectPending } = useConnect();
const { disconnect } = useDisconnect();
const { switchChain } = useSwitchChain();
const { writeContractAsync, isPending } = useWriteContract();

const factory = (import.meta as any).env?.VITE_ESCROW_FACTORY || "";
const dispute = (import.meta as any).env?.VITE_DISPUTE_MODULE || "";
const expectedChain = arbitrumSepolia.id;
const wrongChain = isConnected && chainId !== expectedChain;

const [seller, setSeller] = useState("");
const [token, setToken] = useState("");
const [amount, setAmount] = useState("1000000");
const [timeoutAt, setTimeoutAt] = useState(String(Math.floor(Date.now() / 1000) + 3600));
const [cid, setCid] = useState("ipfs://demo");
const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
const [statusText, setStatusText] = useState("待操作");
const [uiError, setUiError] = useState("");

const [escrowAddrForDispute, setEscrowAddrForDispute] = useState("");
const [disputeId, setDisputeId] = useState("1");
const [voteDisputeId, setVoteDisputeId] = useState("1");
const [voteSellerBps, setVoteSellerBps] = useState("7000");

const [escrowActionAddr, setEscrowActionAddr] = useState("");
const [escrowActionCid, setEscrowActionCid] = useState("ipfs://dispute");

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

const txReceipt = useWaitForTransactionReceipt({ hash: txHash });

const createErrors = useMemo(() => {
const errors: string[] = [];
if (!isAddress(seller || "0x")) errors.push("seller 地址无效");
if (!isAddress(token || "0x")) errors.push("token 地址无效");
if (!/^\d+$/.test(amount) || BigInt(amount || "0") <= 0n) errors.push("amount 必须是正整数");
if (!/^\d+$/.test(timeoutAt) || BigInt(timeoutAt || "0") <= BigInt(Math.floor(Date.now() / 1000))) errors.push("timeoutAt 必须大于当前时间");
if (!cid.trim()) errors.push("evidenceCID 不能为空");
return errors;
}, [seller, token, amount, timeoutAt, cid]);

const canTransact = isConnected && !wrongChain;

function clearError() {
setUiError("");
}

async function onCreate() {
clearError();
if (!factory) return alert("请先配置 VITE_ESCROW_FACTORY");
if (createErrors.length) return setUiError(createErrors.join("；"));
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 createEscrow 交易中...");
const hash = await writeContractAsync({
address: factory as `0x${string}`,
abi: escrowFactoryAbi,
functionName: "createEscrow",
args: [seller as `0x${string}`, token as `0x${string}`, BigInt(amount), BigInt(timeoutAt), cid]
});
setTxHash(hash);
setStatusText("已提交 createEscrow，等待链上确认...");
setTimeout(() => nextEscrow.refetch(), 3000);
} catch (e: any) {
setStatusText("createEscrow 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

async function onOpenDispute() {
clearError();
if (!dispute) return alert("请先配置 VITE_DISPUTE_MODULE");
if (!isAddress(escrowAddrForDispute || "0x")) return setUiError("escrow 地址无效");
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 openDispute 交易中...");
const hash = await writeContractAsync({
address: dispute as `0x${string}`,
abi: disputeAbi,
functionName: "openDispute",
args: [escrowAddrForDispute as `0x${string}`]
});
setTxHash(hash);
setStatusText("已提交 openDispute，等待链上确认...");
setTimeout(() => disputeInfo.refetch(), 3000);
} catch (e: any) {
setStatusText("openDispute 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

async function onVote() {
clearError();
if (!dispute) return alert("请先配置 VITE_DISPUTE_MODULE");
if (!/^\d+$/.test(voteDisputeId)) return setUiError("vote disputeId 无效");
if (!/^\d+$/.test(voteSellerBps)) return setUiError("sellerBps 无效");
const bps = Number(voteSellerBps);
if (bps < 0 || bps > 10000) return setUiError("sellerBps 需在 0~10000");
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 vote 交易中...");
const hash = await writeContractAsync({
address: dispute as `0x${string}`,
abi: disputeAbi,
functionName: "vote",
args: [BigInt(voteDisputeId), bps]
});
setTxHash(hash);
setStatusText("已提交 vote，等待链上确认...");
setTimeout(() => disputeInfo.refetch(), 3000);
} catch (e: any) {
setStatusText("vote 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

async function onEscrowFund() {
clearError();
if (!isAddress(escrowActionAddr || "0x")) return setUiError("escrow 地址无效");
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 fund 交易中...");
const hash = await writeContractAsync({
address: escrowActionAddr as `0x${string}`,
abi: escrowAbi,
functionName: "fund"
});
setTxHash(hash);
setStatusText("已提交 fund，等待链上确认...");
} catch (e: any) {
setStatusText("fund 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

async function onEscrowRelease() {
clearError();
if (!isAddress(escrowActionAddr || "0x")) return setUiError("escrow 地址无效");
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 releaseToSeller 交易中...");
const hash = await writeContractAsync({
address: escrowActionAddr as `0x${string}`,
abi: escrowAbi,
functionName: "releaseToSeller"
});
setTxHash(hash);
setStatusText("已提交 releaseToSeller，等待链上确认...");
} catch (e: any) {
setStatusText("releaseToSeller 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

async function onEscrowDispute() {
clearError();
if (!isAddress(escrowActionAddr || "0x")) return setUiError("escrow 地址无效");
if (!escrowActionCid.trim()) return setUiError("争议 CID 不能为空");
if (!canTransact) return setUiError("请先连接钱包并切换到 Arbitrum Sepolia");
try {
setStatusText("发送 markDispute 交易中...");
const hash = await writeContractAsync({
address: escrowActionAddr as `0x${string}`,
abi: escrowAbi,
functionName: "markDispute",
args: [escrowActionCid]
});
setTxHash(hash);
setStatusText("已提交 markDispute，等待链上确认...");
} catch (e: any) {
setStatusText("markDispute 失败");
setUiError(e?.shortMessage || e?.message || "交易失败");
}
}

return (
<main style={{ maxWidth: 860, margin: "24px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
<h1>DGP-P2P Web</h1>
<p>钱包：{isConnected ? `已连接 ${address}` : "未连接"}</p>
<p>链：{chainId || "-"} {wrongChain ? "(错误链)" : ""}</p>
{!isConnected && (
<button onClick={() => connect({ connector: connectors[0] })} disabled={connectPending}>
{connectPending ? "连接中..." : "连接钱包"}
</button>
)}
{isConnected && <button onClick={() => disconnect()} style={{ marginRight: 8 }}>断开连接</button>}
{wrongChain && <button onClick={() => switchChain({ chainId: expectedChain })}>切换到 Arbitrum Sepolia</button>}
<p>Factory: {factory || "未配置"}</p>
<p>Dispute: {dispute || "未配置"}</p>
<p>nextEscrowId: {nextEscrow.isLoading ? "读取中..." : String(nextEscrow.data ?? "-")}</p>
<p>交易状态：{isPending ? "钱包确认中..." : statusText}</p>
{txHash && <p>Tx: {txHash}</p>}
{txReceipt.isSuccess && <p>链上确认：{txReceipt.data?.status}</p>}
{uiError && <p style={{ color: "crimson" }}>错误：{uiError}</p>}

<hr />
<h3>Create Escrow</h3>
<input placeholder="seller 0x..." value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="token 0x..." value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="timeoutAt(unix)" value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="evidence CID" value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
{createErrors.length > 0 && <p style={{ color: "crimson" }}>校验：{createErrors.join("；")}</p>}
<button onClick={onCreate} disabled={isPending || createErrors.length > 0}>{isPending ? "发送中..." : "创建 Escrow"}</button>

<hr />
<h3>Open Dispute</h3>
<input placeholder="escrow address 0x..." value={escrowAddrForDispute} onChange={(e) => setEscrowAddrForDispute(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onOpenDispute} disabled={isPending}>{isPending ? "发送中..." : "发起争议"}</button>

<hr />
<h3>Vote Dispute</h3>
<input placeholder="disputeId" value={voteDisputeId} onChange={(e) => setVoteDisputeId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="sellerBps(0~10000)" value={voteSellerBps} onChange={(e) => setVoteSellerBps(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onVote} disabled={isPending}>{isPending ? "发送中..." : "投票"}</button>

<hr />
<h3>Query Dispute</h3>
<input placeholder="disputeId" value={disputeId} onChange={(e) => setDisputeId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={() => disputeInfo.refetch()}>刷新争议状态</button>
<pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(disputeInfo.data ?? null, null, 2)}
</pre>

<hr />
<h3>Escrow Actions</h3>
<input placeholder="escrow address 0x..." value={escrowActionAddr} onChange={(e) => setEscrowActionAddr(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<input placeholder="dispute cid" value={escrowActionCid} onChange={(e) => setEscrowActionCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={onEscrowFund} disabled={isPending} style={{ marginRight: 8 }}>Fund</button>
<button onClick={onEscrowRelease} disabled={isPending} style={{ marginRight: 8 }}>Release</button>
<button onClick={onEscrowDispute} disabled={isPending}>Mark Dispute</button>
</main>
);
}

function App() {
return (
<WagmiProvider config={config}>
<QueryClientProvider client={queryClient}>
<ErrorBoundary>
<Panel />
</ErrorBoundary>
</QueryClientProvider>
</WagmiProvider>
);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
