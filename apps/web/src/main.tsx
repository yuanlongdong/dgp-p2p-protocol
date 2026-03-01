import React, { useState } from "react";
import ReactDOM from "react-dom/client";

function App() {
const [factory, setFactory] = useState("");
const [dispute, setDispute] = useState("");
const [escrowId, setEscrowId] = useState("1");

return (
<main style={{ maxWidth: 760, margin: "32px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
<h1>DGP-P2P Web (Phase 7)</h1>
<p>先填部署后的合约地址，下一步接 wagmi/viem 实际调用。</p>

<section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
<h3>配置</h3>
<label>EscrowFactory 地址</label>
<input value={factory} onChange={(e) => setFactory(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<label>DisputeModule 地址</label>
<input value={dispute} onChange={(e) => setDispute(e.target.value)} style={{ width: "100%" }} />
</section>

<section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
<h3>创建 Escrow（UI占位）</h3>
<button onClick={() => alert("下一步接 createEscrow() 合约调用")}>Create Escrow</button>
</section>

<section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
<h3>争议流程（UI占位）</h3>
<label>Escrow ID</label>
<input value={escrowId} onChange={(e) => setEscrowId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
<button onClick={() => alert(`下一步接 openDispute() / vote()，当前 EscrowID=${escrowId}`)}>
Open Dispute / Vote
</button>
</section>

<section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
<h3>状态查询（UI占位）</h3>
<button onClick={() => alert("下一步接 escrows(id) / getDispute(id) 读链")}>Query Status</button>
</section>
</main>
);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
