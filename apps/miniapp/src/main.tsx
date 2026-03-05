import React from "react";
import ReactDOM from "react-dom/client";
import {
  WagmiProvider, createConfig, http, useAccount, useConnect, useReadContract,
  useSwitchChain, useWriteContract, useWaitForTransactionReceipt
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { isAddress } from "viem";

const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: { [arbitrumSepolia.id]: http() }
});

const escrowFactoryAbi = [
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

const escrowAbi = [
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "releaseToSeller", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "markDispute", stateMutability: "nonpayable", inputs: [{ name: "cid", type: "string" }], outputs: [] }
] as const;

const governorAbi = [
  { type: "function", name: "proposalCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "state", stateMutability: "view", inputs: [{ name: "proposalId", type: "uint256" }], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kind", type: "uint8" },
      { name: "value", type: "uint16" },
      { name: "description", type: "string" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }, { name: "support", type: "bool" }],
    outputs: []
  },
  { type: "function", name: "queue", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }], outputs: [] },
  { type: "function", name: "execute", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }], outputs: [] }
] as const;

const complianceAbi = [
  { type: "function", name: "setKyc", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { type: "function", name: "setBlacklist", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "blacklisted", type: "bool" }], outputs: [] },
  { type: "function", name: "setSanction", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "sanctioned", type: "bool" }], outputs: [] },
  { type: "function", name: "setAmlRiskScore", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "riskBps", type: "uint16" }], outputs: [] },
  { type: "function", name: "setAmlConfig", stateMutability: "nonpayable", inputs: [{ name: "enforce", type: "bool" }, { name: "maxRiskBps", type: "uint16" }], outputs: [] }
] as const;

type TelegramUser = { id?: number; username?: string; first_name?: string };

function useTelegram() {
  const [user, setUser] = React.useState<TelegramUser>({});
  const [platform, setPlatform] = React.useState("unknown");

  React.useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    setPlatform(tg.platform || "unknown");
    setUser(tg.initDataUnsafe?.user || {});
  }, []);

  return { user, platform };
}

function App() {
  const { user, platform } = useTelegram();
  const { isConnected, address, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>();
  const [status, setStatus] = React.useState("Idle");
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const factory = ((import.meta as any).env?.VITE_ESCROW_FACTORY || "") as `0x${string}`;
  const governor = ((import.meta as any).env?.VITE_DGP_GOVERNOR || "") as `0x${string}`;
  const compliance = ((import.meta as any).env?.VITE_COMPLIANCE_REGISTRY || "") as `0x${string}`;

  const [seller, setSeller] = React.useState("");
  const [token, setToken] = React.useState("");
  const [amount, setAmount] = React.useState("1000000");
  const [timeoutAt, setTimeoutAt] = React.useState(String(Math.floor(Date.now() / 1000) + 3600));
  const [cid, setCid] = React.useState("ipfs://miniapp");

  const [escrow, setEscrow] = React.useState("");
  const [disputeCid, setDisputeCid] = React.useState("ipfs://dispute");

  const [proposalKind, setProposalKind] = React.useState("0");
  const [proposalValue, setProposalValue] = React.useState("120");
  const [proposalDesc, setProposalDesc] = React.useState("Adjust protocol parameter");
  const [proposalId, setProposalId] = React.useState("1");
  const [support, setSupport] = React.useState(true);

  const [cmpAccount, setCmpAccount] = React.useState("");
  const [cmpFlag, setCmpFlag] = React.useState(true);
  const [cmpRiskBps, setCmpRiskBps] = React.useState("3000");
  const [amlEnforce, setAmlEnforce] = React.useState(true);
  const [amlMaxRiskBps, setAmlMaxRiskBps] = React.useState("7000");

  const proposalCount = useReadContract({
    address: governor || undefined,
    abi: governorAbi,
    functionName: "proposalCount",
    query: { enabled: !!governor }
  });

  const proposalState = useReadContract({
    address: governor || undefined,
    abi: governorAbi,
    functionName: "state",
    args: [BigInt(proposalId || "1")],
    query: { enabled: !!governor && /^\d+$/.test(proposalId) }
  });

  const wrongChain = isConnected && chainId !== arbitrumSepolia.id;

  function canSend() {
    if (!isConnected) {
      setStatus("请先连接钱包");
      return false;
    }
    if (wrongChain) {
      setStatus("请切换到 Arbitrum Sepolia");
      return false;
    }
    return true;
  }

  async function sendCreate() {
    if (!factory) return setStatus("缺少 VITE_ESCROW_FACTORY");
    if (!isAddress(seller || "0x")) return setStatus("seller 地址无效");
    if (!isAddress(token || "0x")) return setStatus("token 地址无效");
    if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) return setStatus("amount 无效");
    if (!/^\d+$/.test(timeoutAt) || BigInt(timeoutAt) <= BigInt(Math.floor(Date.now() / 1000))) return setStatus("timeoutAt 无效");
    if (!cid.trim()) return setStatus("evidence cid 不能为空");
    if (!canSend()) return;
    try {
      setStatus("发送 createEscrow...");
      const hash = await writeContractAsync({
        address: factory,
        abi: escrowFactoryAbi,
        functionName: "createEscrow",
        args: [seller as `0x${string}`, token as `0x${string}`, BigInt(amount), BigInt(timeoutAt), cid]
      });
      setTxHash(hash);
      setStatus("createEscrow 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "createEscrow 失败");
    }
  }

  async function sendFund() {
    if (!isAddress(escrow || "0x")) return setStatus("escrow 地址无效");
    if (!canSend()) return;
    try {
      setStatus("发送 fund...");
      const hash = await writeContractAsync({ address: escrow as `0x${string}`, abi: escrowAbi, functionName: "fund" });
      setTxHash(hash);
      setStatus("fund 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "fund 失败");
    }
  }

  async function sendRelease() {
    if (!isAddress(escrow || "0x")) return setStatus("escrow 地址无效");
    if (!canSend()) return;
    try {
      setStatus("发送 releaseToSeller...");
      const hash = await writeContractAsync({ address: escrow as `0x${string}`, abi: escrowAbi, functionName: "releaseToSeller" });
      setTxHash(hash);
      setStatus("releaseToSeller 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "releaseToSeller 失败");
    }
  }

  async function sendDispute() {
    if (!isAddress(escrow || "0x")) return setStatus("escrow 地址无效");
    if (!disputeCid.trim()) return setStatus("dispute cid 不能为空");
    if (!canSend()) return;
    try {
      setStatus("发送 markDispute...");
      const hash = await writeContractAsync({
        address: escrow as `0x${string}`,
        abi: escrowAbi,
        functionName: "markDispute",
        args: [disputeCid]
      });
      setTxHash(hash);
      setStatus("markDispute 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "markDispute 失败");
    }
  }

  async function govPropose() {
    if (!governor) return setStatus("缺少 VITE_DGP_GOVERNOR");
    if (!/^[01]$/.test(proposalKind)) return setStatus("kind 仅支持 0/1");
    if (!/^\d+$/.test(proposalValue)) return setStatus("proposal value 无效");
    if (!proposalDesc.trim()) return setStatus("proposal description 不能为空");
    if (!canSend()) return;
    try {
      setStatus("发送 propose...");
      const hash = await writeContractAsync({
        address: governor,
        abi: governorAbi,
        functionName: "propose",
        args: [Number(proposalKind), Number(proposalValue), proposalDesc]
      });
      setTxHash(hash);
      setStatus("propose 已提交");
      setTimeout(() => proposalCount.refetch(), 3000);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "propose 失败");
    }
  }

  async function govVote() {
    if (!governor) return setStatus("缺少 VITE_DGP_GOVERNOR");
    if (!/^\d+$/.test(proposalId)) return setStatus("proposalId 无效");
    if (!canSend()) return;
    try {
      setStatus("发送 castVote...");
      const hash = await writeContractAsync({
        address: governor,
        abi: governorAbi,
        functionName: "castVote",
        args: [BigInt(proposalId), support]
      });
      setTxHash(hash);
      setStatus("castVote 已提交");
      setTimeout(() => proposalState.refetch(), 3000);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "castVote 失败");
    }
  }

  async function govQueue() {
    if (!governor) return setStatus("缺少 VITE_DGP_GOVERNOR");
    if (!/^\d+$/.test(proposalId)) return setStatus("proposalId 无效");
    if (!canSend()) return;
    try {
      setStatus("发送 queue...");
      const hash = await writeContractAsync({
        address: governor,
        abi: governorAbi,
        functionName: "queue",
        args: [BigInt(proposalId)]
      });
      setTxHash(hash);
      setStatus("queue 已提交");
      setTimeout(() => proposalState.refetch(), 3000);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "queue 失败");
    }
  }

  async function govExecute() {
    if (!governor) return setStatus("缺少 VITE_DGP_GOVERNOR");
    if (!/^\d+$/.test(proposalId)) return setStatus("proposalId 无效");
    if (!canSend()) return;
    try {
      setStatus("发送 execute...");
      const hash = await writeContractAsync({
        address: governor,
        abi: governorAbi,
        functionName: "execute",
        args: [BigInt(proposalId)]
      });
      setTxHash(hash);
      setStatus("execute 已提交");
      setTimeout(() => proposalState.refetch(), 3000);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "execute 失败");
    }
  }

  async function cmpSetKyc() {
    if (!compliance) return setStatus("缺少 VITE_COMPLIANCE_REGISTRY");
    if (!isAddress(cmpAccount || "0x")) return setStatus("compliance account 地址无效");
    if (!canSend()) return;
    try {
      setStatus("发送 setKyc...");
      const hash = await writeContractAsync({
        address: compliance,
        abi: complianceAbi,
        functionName: "setKyc",
        args: [cmpAccount as `0x${string}`, cmpFlag]
      });
      setTxHash(hash);
      setStatus("setKyc 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "setKyc 失败");
    }
  }

  async function cmpSetBlacklist() {
    if (!compliance) return setStatus("缺少 VITE_COMPLIANCE_REGISTRY");
    if (!isAddress(cmpAccount || "0x")) return setStatus("compliance account 地址无效");
    if (!canSend()) return;
    try {
      setStatus("发送 setBlacklist...");
      const hash = await writeContractAsync({
        address: compliance,
        abi: complianceAbi,
        functionName: "setBlacklist",
        args: [cmpAccount as `0x${string}`, cmpFlag]
      });
      setTxHash(hash);
      setStatus("setBlacklist 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "setBlacklist 失败");
    }
  }

  async function cmpSetSanction() {
    if (!compliance) return setStatus("缺少 VITE_COMPLIANCE_REGISTRY");
    if (!isAddress(cmpAccount || "0x")) return setStatus("compliance account 地址无效");
    if (!canSend()) return;
    try {
      setStatus("发送 setSanction...");
      const hash = await writeContractAsync({
        address: compliance,
        abi: complianceAbi,
        functionName: "setSanction",
        args: [cmpAccount as `0x${string}`, cmpFlag]
      });
      setTxHash(hash);
      setStatus("setSanction 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "setSanction 失败");
    }
  }

  async function cmpSetRisk() {
    if (!compliance) return setStatus("缺少 VITE_COMPLIANCE_REGISTRY");
    if (!isAddress(cmpAccount || "0x")) return setStatus("compliance account 地址无效");
    if (!/^\d+$/.test(cmpRiskBps) || Number(cmpRiskBps) > 10000) return setStatus("riskBps 无效");
    if (!canSend()) return;
    try {
      setStatus("发送 setAmlRiskScore...");
      const hash = await writeContractAsync({
        address: compliance,
        abi: complianceAbi,
        functionName: "setAmlRiskScore",
        args: [cmpAccount as `0x${string}`, Number(cmpRiskBps)]
      });
      setTxHash(hash);
      setStatus("setAmlRiskScore 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "setAmlRiskScore 失败");
    }
  }

  async function cmpSetAmlConfig() {
    if (!compliance) return setStatus("缺少 VITE_COMPLIANCE_REGISTRY");
    if (!/^\d+$/.test(amlMaxRiskBps) || Number(amlMaxRiskBps) > 10000) return setStatus("maxRiskBps 无效");
    if (!canSend()) return;
    try {
      setStatus("发送 setAmlConfig...");
      const hash = await writeContractAsync({
        address: compliance,
        abi: complianceAbi,
        functionName: "setAmlConfig",
        args: [amlEnforce, Number(amlMaxRiskBps)]
      });
      setTxHash(hash);
      setStatus("setAmlConfig 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "setAmlConfig 失败");
    }
  }

  return (
    <WagmiProvider config={config}>
      <main style={{ maxWidth: 720, margin: "24px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
        <h1>DGP Telegram Mini App</h1>
        <p>Telegram 平台: {platform}</p>
        <p>Telegram 用户: {user.username || user.first_name || "unknown"} ({user.id || "-"})</p>
        <p>钱包: {isConnected ? address : "未连接"}</p>
        {!isConnected && <button onClick={() => connect({ connector: connectors[0] })}>连接钱包</button>}
        {wrongChain && <button onClick={() => switchChain({ chainId: arbitrumSepolia.id })}>切换到 Arbitrum Sepolia</button>}

        <p>Factory: {factory || "未配置"}</p>
        <p>Governor: {governor || "未配置"}</p>
        <p>Compliance: {compliance || "未配置"}</p>

        <hr />
        <h3>Create</h3>
        <input placeholder="seller 0x..." value={seller} onChange={(e) => setSeller(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="token 0x..." value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="timeoutAt(unix)" value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="evidence cid" value={cid} onChange={(e) => setCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={sendCreate} disabled={isPending || !isConnected || wrongChain}>创建 Escrow</button>

        <hr />
        <h3>Escrow Actions</h3>
        <input placeholder="escrow 0x..." value={escrow} onChange={(e) => setEscrow(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="dispute cid" value={disputeCid} onChange={(e) => setDisputeCid(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={sendFund} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>Fund</button>
        <button onClick={sendRelease} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>Release</button>
        <button onClick={sendDispute} disabled={isPending || !isConnected || wrongChain}>Dispute</button>

        <hr />
        <h3>Governance</h3>
        <p>proposalCount: {proposalCount.isLoading ? "读取中..." : String(proposalCount.data ?? "-")}</p>
        <input placeholder="kind: 0 fee / 1 collateral" value={proposalKind} onChange={(e) => setProposalKind(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="value" value={proposalValue} onChange={(e) => setProposalValue(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <input placeholder="description" value={proposalDesc} onChange={(e) => setProposalDesc(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <button onClick={govPropose} disabled={isPending || !isConnected || wrongChain}>Propose</button>

        <div style={{ marginTop: 8 }}>
          <input placeholder="proposalId" value={proposalId} onChange={(e) => setProposalId(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <label style={{ marginRight: 8 }}>
            <input type="radio" checked={support} onChange={() => setSupport(true)} />
            支持
          </label>
          <label>
            <input type="radio" checked={!support} onChange={() => setSupport(false)} />
            反对
          </label>
        </div>
        <p>state: {proposalState.isLoading ? "读取中..." : String(proposalState.data ?? "-")}</p>
        <button onClick={govVote} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>Vote</button>
        <button onClick={govQueue} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>Queue</button>
        <button onClick={govExecute} disabled={isPending || !isConnected || wrongChain}>Execute</button>

        <hr />
        <h3>Compliance Admin</h3>
        <input placeholder="account 0x..." value={cmpAccount} onChange={(e) => setCmpAccount(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
        <label style={{ marginRight: 8 }}>
          <input type="radio" checked={cmpFlag} onChange={() => setCmpFlag(true)} />
          true
        </label>
        <label>
          <input type="radio" checked={!cmpFlag} onChange={() => setCmpFlag(false)} />
          false
        </label>
        <div style={{ marginTop: 8 }}>
          <button onClick={cmpSetKyc} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>setKyc</button>
          <button onClick={cmpSetBlacklist} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>setBlacklist</button>
          <button onClick={cmpSetSanction} disabled={isPending || !isConnected || wrongChain}>setSanction</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <input placeholder="riskBps (0-10000)" value={cmpRiskBps} onChange={(e) => setCmpRiskBps(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <button onClick={cmpSetRisk} disabled={isPending || !isConnected || wrongChain} style={{ marginRight: 8 }}>setAmlRiskScore</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ marginRight: 8 }}>
            <input type="radio" checked={amlEnforce} onChange={() => setAmlEnforce(true)} />
            AML On
          </label>
          <label>
            <input type="radio" checked={!amlEnforce} onChange={() => setAmlEnforce(false)} />
            AML Off
          </label>
          <input placeholder="maxRiskBps (0-10000)" value={amlMaxRiskBps} onChange={(e) => setAmlMaxRiskBps(e.target.value)} style={{ width: "100%", marginTop: 8, marginBottom: 8 }} />
          <button onClick={cmpSetAmlConfig} disabled={isPending || !isConnected || wrongChain}>setAmlConfig</button>
        </div>

        <hr />
        <p>状态: {status}</p>
        {txHash && <p>Tx: {txHash}</p>}
        {receipt.isSuccess && <p>Receipt: {receipt.data?.status}</p>}
      </main>
    </WagmiProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
