import React from "react";
import ReactDOM from "react-dom/client";
import {
  WagmiProvider, createConfig, http, useAccount, useConnect, useSwitchChain,
  useWriteContract, useWaitForTransactionReceipt
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

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

  const factory = ((import.meta as any).env?.VITE_ESCROW_FACTORY || "") as `0x${string}`;
  const [seller, setSeller] = React.useState("");
  const [token, setToken] = React.useState("");
  const [amount, setAmount] = React.useState("1000000");
  const [timeoutAt, setTimeoutAt] = React.useState(String(Math.floor(Date.now() / 1000) + 3600));
  const [cid, setCid] = React.useState("ipfs://miniapp");

  const [escrow, setEscrow] = React.useState("");
  const [disputeCid, setDisputeCid] = React.useState("ipfs://dispute");
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const wrongChain = isConnected && chainId !== arbitrumSepolia.id;

  async function sendCreate() {
    if (!factory) return setStatus("缺少 VITE_ESCROW_FACTORY");
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
    try {
      setStatus("发送 fund...");
      const hash = await writeContractAsync({
        address: escrow as `0x${string}`,
        abi: escrowAbi,
        functionName: "fund"
      });
      setTxHash(hash);
      setStatus("fund 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "fund 失败");
    }
  }

  async function sendRelease() {
    try {
      setStatus("发送 releaseToSeller...");
      const hash = await writeContractAsync({
        address: escrow as `0x${string}`,
        abi: escrowAbi,
        functionName: "releaseToSeller"
      });
      setTxHash(hash);
      setStatus("releaseToSeller 已提交");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "releaseToSeller 失败");
    }
  }

  async function sendDispute() {
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

  return (
    <WagmiProvider config={config}>
      <main style={{ maxWidth: 720, margin: "24px auto", fontFamily: "sans-serif", lineHeight: 1.5 }}>
        <h1>DGP Telegram Mini App</h1>
        <p>Telegram 平台: {platform}</p>
        <p>Telegram 用户: {user.username || user.first_name || "unknown"} ({user.id || "-"})</p>
        <p>钱包: {isConnected ? address : "未连接"}</p>
        {!isConnected && <button onClick={() => connect({ connector: connectors[0] })}>连接钱包</button>}
        {wrongChain && <button onClick={() => switchChain({ chainId: arbitrumSepolia.id })}>切换到 Arbitrum Sepolia</button>}

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
        <p>状态: {status}</p>
        {txHash && <p>Tx: {txHash}</p>}
        {receipt.isSuccess && <p>Receipt: {receipt.data?.status}</p>}
      </main>
    </WagmiProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
