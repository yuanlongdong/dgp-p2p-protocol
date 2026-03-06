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
  const nextEscrow = useReadContract({
    address: factory ? (factory as any) : undefined,
    abi: escrowFactoryAbi,
    functionName: "nextEscrowId",
    query: { enabled: !!factory }
  });

  const disputeInfo = useReadContract({
    address: dispute ? (dispute as any) : undefined,
    abi: disputeAbi,
    functionName: "getDispute",
    args: [BigInt(disputeId || "1")],
    query: { enabled: !!dispute }
  });

  async function onCreate() {
    if (!factory) return alert("请先配置 VITE_ESCROW_FACTORY");
    const hash = await writeContractAsync({
      address: factory as any,
      abi: escrowFactoryAbi,
      functionName: "createEscrow",
      args: [seller as any, token as any, BigInt(amount), BigInt(timeoutAt), cid]
    });
    setTxHash(hash);
    setTimeout(() => nextEscrow.refetch(), 3000);
  }

  async function onOpenDispute() {
    if (!dispute) return alert("请先配置 VITE_DISPUTE_MODULE");
    const hash = await writeContractAsync({
      address: dispute as any,
      abi: disputeAbi,
      functionName: "openDispute",
      args: [escrowAddrForDispute as any]
    });
    setTxHash(hash);
    setTimeout(() => disputeInfo.refetch(), 3000);
  }

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f2f8ff 0%, #fff7ef 42%, #eefbf4 100%)",
    padding: "28px 16px 48px",
    color: "#1f2937",
    fontFamily: "'Segoe UI', 'PingFang SC', sans-serif"
  };

  const shell: React.CSSProperties = { maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 };
  const hero: React.CSSProperties = {
    borderRadius: 18, padding: 20, background: "linear-gradient(160deg, #1f4ba5 0%, #0c7c59 100%)",
    color: "#f8fbff", boxShadow: "0 16px 30px rgba(9, 30, 66, 0.22)"
  };
  const row: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 14
  };
  const stat: React.CSSProperties = {
    borderRadius: 12, padding: "10px 12px", background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.22)", fontSize: 13
  };
  const card: React.CSSProperties = {
    borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.9)",
    border: "1px solid #d7e5f8", boxShadow: "0 10px 20px rgba(17, 24, 39, 0.06)"
  };
  const sectionTitle: React.CSSProperties = { margin: "0 0 10px", fontSize: 18, fontWeight: 700, letterSpacing: 0.2 };
  const field: React.CSSProperties = {
    width: "100%", padding: "10px 12px", marginBottom: 10, borderRadius: 10,
    border: "1px solid #cfd9e8", background: "#fdfefe", outline: "none", fontSize: 14
  };
  const primaryBtn: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 10, border: "none",
    background: "linear-gradient(90deg, #155dfc 0%, #0ea5e9 100%)", color: "#ffffff", fontWeight: 700, cursor: "pointer"
  };
  const ghostBtn: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 10, border: "1px solid #a7bfdc",
    background: "#ffffff", color: "#1f3b67", fontWeight: 700, cursor: "pointer"
  };
  const mono: React.CSSProperties = {
    background: "#0f172a", color: "#cde8ff", padding: 12, borderRadius: 10, overflow: "auto", fontSize: 12, lineHeight: 1.45
  };

  return (
    <main style={page}>
      <div style={shell}>
        <section style={hero}>
          <h1 style={{ margin: 0, fontSize: 30 }}>DGP-P2P Console</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.92 }}>去中心化托管、争议和风控一体化操作台（Phase 9）。</p>
          <div style={row}>
            <div style={stat}>钱包：{isConnected ? ("已连接 " + address) : "未连接"}</div>
            <div style={stat}>Factory：{factory || "未配置"}</div>
            <div style={stat}>Dispute：{dispute || "未配置"}</div>
            <div style={stat}>nextEscrowId：{nextEscrow.isLoading ? "读取中..." : String(nextEscrow.data ?? "-")}</div>
          </div>
        </section>

        <section style={card}>
          <h3 style={sectionTitle}>Create Escrow</h3>
          <input placeholder="seller 0x..." value={seller} onChange={(e) => setSeller(e.target.value)} style={field} />
          <input placeholder="token 0x..." value={token} onChange={(e) => setToken(e.target.value)} style={field} />
          <input placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={field} />
          <input placeholder="timeoutAt(unix)" value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={field} />
          <input placeholder="evidence CID" value={cid} onChange={(e) => setCid(e.target.value)} style={field} />
          <button onClick={onCreate} disabled={isPending} style={primaryBtn}>{isPending ? "发送中..." : "创建 Escrow"}</button>
        </section>

        <section style={card}>
          <h3 style={sectionTitle}>Open Dispute</h3>
          <input placeholder="escrow address 0x..." value={escrowAddrForDispute} onChange={(e) => setEscrowAddrForDispute(e.target.value)} style={field} />
          <button onClick={onOpenDispute} disabled={isPending} style={primaryBtn}>{isPending ? "发送中..." : "发起争议"}</button>
        </section>
        <section style={card}>
          <h3 style={sectionTitle}>Query Dispute</h3>
          <input placeholder="disputeId" value={disputeId} onChange={(e) => setDisputeId(e.target.value)} style={field} />
          <button onClick={() => disputeInfo.refetch()} style={ghostBtn}>刷新争议状态</button>
          <pre style={mono}>{JSON.stringify(disputeInfo.data ?? null, null, 2)}</pre>
        </section>

        {txHash && (
          <section style={card}>
            <h3 style={sectionTitle}>Last Tx</h3>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, wordBreak: "break-all" }}>{txHash}</div>
          </section>
        )}
      </div>
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
