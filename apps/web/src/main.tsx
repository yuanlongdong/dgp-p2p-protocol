import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAddress } from "viem";
import {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

type Locale = "zh-CN" | "en";

const translations: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    appTitle: "DGP-P2P Web（阶段 9）",
    walletLabel: "钱包：",
    walletConnected: "已连接 {address}",
    walletDisconnected: "未连接",
    networkLabel: "网络：",
    networkUnknown: "-",
    networkRightSuffix: "（正确）",
    networkWrongSuffix: "（错误链）",
    connectWallet: "连接钱包",
    connecting: "连接中...",
    disconnectWallet: "断开钱包",
    switchChain: "切换到 Arbitrum Sepolia",
    switching: "切链中...",
    wrongChainWarning: "当前链不正确，已阻止交易操作。",
    factoryLabel: "工厂合约：",
    disputeLabel: "争议合约：",
    nextEscrowIdLabel: "下一个 EscrowId：",
    notSet: "未配置",
    loading: "读取中...",
    createSection: "创建 Escrow",
    sellerPlaceholder: "卖家地址 0x...",
    tokenPlaceholder: "代币地址 0x...",
    amountPlaceholder: "数量",
    timeoutPlaceholder: "截止时间（Unix）",
    cidPlaceholder: "证据 CID",
    createButton: "创建托管",
    sending: "发送中...",
    openDisputeSection: "发起争议",
    escrowPlaceholder: "托管地址 0x...",
    openDisputeButton: "发起争议",
    voteSection: "争议投票",
    disputeIdPlaceholder: "争议 ID",
    sellerBpsPlaceholder: "卖家比例 BPS（0~10000）",
    voteButton: "提交投票",
    querySection: "查询争议",
    refreshDispute: "刷新争议状态",
    txLabel: "交易：",
    txStatusLabel: "交易状态：",
    txPending: "确认中...",
    txSuccess: "已上链",
    txError: "失败",
    txIdle: "等待提交",
    resolved: "已裁决",
    resolving: "处理中",
    alertNeedFactory: "请先配置 VITE_ESCROW_FACTORY",
    alertNeedDispute: "请先配置 VITE_DISPUTE_MODULE",
    alertNeedWallet: "请先连接钱包",
    alertWrongChain: "当前网络错误，请切换到 Arbitrum Sepolia",
    errorInvalidSeller: "卖家地址无效",
    errorInvalidToken: "代币地址无效",
    errorInvalidAmount: "数量必须是大于 0 的整数",
    errorInvalidTimeout: "截止时间必须晚于当前时间",
    errorInvalidCid: "证据 CID 不能为空",
    errorInvalidSellerBps: "卖家比例必须在 0~10000",
  },
  en: {
    appTitle: "DGP-P2P Web (Phase 9)",
    walletLabel: "Wallet: ",
    walletConnected: "Connected {address}",
    walletDisconnected: "Disconnected",
    networkLabel: "Network: ",
    networkUnknown: "-",
    networkRightSuffix: " (ok)",
    networkWrongSuffix: " (wrong)",
    connectWallet: "Connect Wallet",
    connecting: "Connecting...",
    disconnectWallet: "Disconnect",
    switchChain: "Switch to Arbitrum Sepolia",
    switching: "Switching...",
    wrongChainWarning: "Wrong network. Transactions are blocked.",
    factoryLabel: "Factory: ",
    disputeLabel: "Dispute: ",
    nextEscrowIdLabel: "nextEscrowId: ",
    notSet: "NOT_SET",
    loading: "Loading...",
    createSection: "Create Escrow",
    sellerPlaceholder: "seller 0x...",
    tokenPlaceholder: "token 0x...",
    amountPlaceholder: "amount",
    timeoutPlaceholder: "timeoutAt (Unix)",
    cidPlaceholder: "evidence CID",
    createButton: "Create Escrow",
    sending: "Sending...",
    openDisputeSection: "Open Dispute",
    escrowPlaceholder: "escrow address 0x...",
    openDisputeButton: "Open Dispute",
    voteSection: "Vote Dispute",
    disputeIdPlaceholder: "disputeId",
    sellerBpsPlaceholder: "sellerBps (0~10000)",
    voteButton: "Submit Vote",
    querySection: "Query Dispute",
    refreshDispute: "Refresh",
    txLabel: "Tx: ",
    txStatusLabel: "Tx Status: ",
    txPending: "Confirming...",
    txSuccess: "Confirmed",
    txError: "Failed",
    txIdle: "Waiting",
    resolved: "Resolved",
    resolving: "Pending",
    alertNeedFactory: "Please set VITE_ESCROW_FACTORY first.",
    alertNeedDispute: "Please set VITE_DISPUTE_MODULE first.",
    alertNeedWallet: "Please connect your wallet first.",
    alertWrongChain: "Wrong network. Please switch to Arbitrum Sepolia.",
    errorInvalidSeller: "Invalid seller address.",
    errorInvalidToken: "Invalid token address.",
    errorInvalidAmount: "Amount must be a positive integer.",
    errorInvalidTimeout: "timeoutAt must be later than now.",
    errorInvalidCid: "Evidence CID is required.",
    errorInvalidSellerBps: "sellerBps must be between 0 and 10000.",
  },
};

const resolveLocale = (): Locale => {
  const envLang = (import.meta as any).env?.VITE_LANG as string | undefined;
  const raw = (envLang || "zh-CN").toLowerCase();
  return raw.startsWith("en") ? "en" : "zh-CN";
};

const t = (key: string, params: Record<string, string | number> = {}) => {
  const locale = resolveLocale();
  const template =
    translations[locale][key] ?? translations["zh-CN"][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
};

const queryClient = new QueryClient();
const config = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: { [arbitrumSepolia.id]: http() },
});

const escrowFactoryAbi = [
  {
    type: "function",
    name: "nextEscrowId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
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
      { name: "evidenceCID", type: "string" },
    ],
    outputs: [{ type: "uint256" }, { type: "address" }],
  },
] as const;

const disputeAbi = [
  {
    type: "function",
    name: "openDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrow", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "disputeId", type: "uint256" },
      { name: "sellerBps", type: "uint16" },
    ],
    outputs: [],
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
      { name: "votes", type: "uint16" },
    ],
  },
] as const;

const escrowAbi = [
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "releaseToSeller",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "markDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "cid", type: "string" }],
    outputs: [],
  },
] as const;

const governorAbi = [
  {
    type: "function",
    name: "proposalCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kind", type: "uint8" },
      { name: "value", type: "uint16" },
      { name: "description", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "queue",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [],
  },
] as const;

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            maxWidth: 860,
            margin: "24px auto",
            fontFamily: "sans-serif",
          }}
        >
          页面异常，请刷新重试。
        </main>
      );
    }
    return this.props.children;
  }
}

function Panel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const targetChainId = arbitrumSepolia.id;
  const isWrongChain = isConnected && chainId !== targetChainId;

  const factory = (import.meta as any).env?.VITE_ESCROW_FACTORY || "";
  const dispute = (import.meta as any).env?.VITE_DISPUTE_MODULE || "";
  const governor = (import.meta as any).env?.VITE_DGP_GOVERNOR || "";
  const subgraphUrl = (import.meta as any).env?.VITE_SUBGRAPH_URL || "";
  const expectedChain = arbitrumSepolia.id;
  const wrongChain = isConnected && chainId !== expectedChain;

  const [seller, setSeller] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [timeoutAt, setTimeoutAt] = useState(
    String(Math.floor(Date.now() / 1000) + 3600),
  );
  const [cid, setCid] = useState("ipfs://demo");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [statusText, setStatusText] = useState("待操作");
  const [uiError, setUiError] = useState("");

  const [escrowAddrForDispute, setEscrowAddrForDispute] = useState("");
  const [disputeId, setDisputeId] = useState("1");
  const [voteDisputeId, setVoteDisputeId] = useState("1");
  const [sellerBps, setSellerBps] = useState("7000");
  const [formError, setFormError] = useState("");

  const txReceipt = useWaitForTransactionReceipt({
    hash: txHash ? (txHash as `0x${string}`) : undefined,
    query: { enabled: !!txHash },
  });

  const nextEscrow = useReadContract({
    address: factory ? (factory as `0x${string}`) : undefined,
    abi: escrowFactoryAbi,
    functionName: "nextEscrowId",
    query: { enabled: !!factory },
  });

  const disputeInfo = useReadContract({
    address: dispute ? (dispute as `0x${string}`) : undefined,
    abi: disputeAbi,
    functionName: "getDispute",
    args: [BigInt(disputeId || "1")],
    query: { enabled: !!dispute },
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
    if (!factory) return alert(t("alertNeedFactory"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
    const parsedAmount = parseUint(amount);
    const parsedTimeout = parseUint(timeoutAt);
    if (!isAddress(seller)) return setFormError(t("errorInvalidSeller"));
    if (!isAddress(token)) return setFormError(t("errorInvalidToken"));
    if (parsedAmount === null || parsedAmount <= 0n)
      return setFormError(t("errorInvalidAmount"));
    if (
      parsedTimeout === null ||
      parsedTimeout <= BigInt(Math.floor(Date.now() / 1000))
    ) {
      return setFormError(t("errorInvalidTimeout"));
    }
    if (!cid.trim()) return setFormError(t("errorInvalidCid"));
    setFormError("");
    try {
      const hash = await writeContractAsync({
        address: factory as `0x${string}`,
        abi: escrowFactoryAbi,
        functionName: "createEscrow",
        args: [
          seller as `0x${string}`,
          token as `0x${string}`,
          parsedAmount,
          parsedTimeout,
          cid,
        ],
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
    if (!dispute) return alert(t("alertNeedDispute"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
    try {
      const hash = await writeContractAsync({
        address: dispute as `0x${string}`,
        abi: disputeAbi,
        functionName: "openDispute",
        args: [escrowAddrForDispute as `0x${string}`],
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
    if (!dispute) return alert(t("alertNeedDispute"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
    const voteBps = Number(sellerBps);
    if (Number.isNaN(voteBps) || voteBps < 0 || voteBps > 10000) {
      return alert(t("errorInvalidSellerBps"));
    }
    try {
      const hash = await writeContractAsync({
        address: dispute as `0x${string}`,
        abi: disputeAbi,
        functionName: "vote",
        args: [BigInt(voteDisputeId || "1"), voteBps],
      });
      setTxHash(hash);
      setDisputeId(voteDisputeId || "1");
      setTimeout(() => disputeInfo.refetch(), 3000);
    } catch (e: any) {
      setStatusText("vote 失败");
      setUiError(e?.shortMessage || e?.message || "交易失败");
    }
  }

  const disputeSummary = disputeInfo.data
    ? {
        escrow: disputeInfo.data[0],
        resolved: disputeInfo.data[1] ? t("resolved") : t("resolving"),
        sellerBps: Number(disputeInfo.data[2]),
        votes: Number(disputeInfo.data[3]),
      }
    : null;

  const parsedAmount = parseUint(amount);
  const parsedTimeout = parseUint(timeoutAt);

  const createDisabled =
    isPending ||
    !isConnected ||
    isWrongChain ||
    !factory ||
    !isAddress(seller) ||
    !isAddress(token) ||
    parsedAmount === null ||
    parsedAmount <= 0n ||
    parsedTimeout === null ||
    parsedTimeout <= BigInt(Math.floor(Date.now() / 1000)) ||
    !cid.trim();

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "24px auto",
        fontFamily: "sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1>{t("appTitle")}</h1>
      <p>
        {t("walletLabel")}
        {isConnected
          ? t("walletConnected", { address: address || "" })
          : t("walletDisconnected")}
      </p>
      <p>
        {t("networkLabel")}
        {isConnected
          ? `${chainId}${isWrongChain ? t("networkWrongSuffix") : t("networkRightSuffix")}`
          : t("networkUnknown")}
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: injected() })}
            disabled={isConnectPending}
          >
            {isConnectPending ? t("connecting") : t("connectWallet")}
          </button>
        ) : (
          <button onClick={() => disconnect()}>{t("disconnectWallet")}</button>
        )}
        {isWrongChain && (
          <button
            onClick={async () => {
              await switchChainAsync({ chainId: targetChainId });
            }}
            disabled={isSwitchPending}
          >
            {isSwitchPending ? t("switching") : t("switchChain")}
          </button>
        )}
      </div>
      {isWrongChain && (
        <p style={{ color: "#c1121f" }}>{t("wrongChainWarning")}</p>
      )}
      <p>
        {t("factoryLabel")}
        {factory || t("notSet")}
      </p>
      <p>
        {t("disputeLabel")}
        {dispute || t("notSet")}
      </p>
      <p>
        {t("nextEscrowIdLabel")}
        {nextEscrow.isLoading ? t("loading") : String(nextEscrow.data ?? "-")}
      </p>

      <hr />
      <h3>{t("createSection")}</h3>
      <input
        placeholder={t("sellerPlaceholder")}
        value={seller}
        onChange={(e) => setSeller(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder={t("tokenPlaceholder")}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder={t("amountPlaceholder")}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder={t("timeoutPlaceholder")}
        value={timeoutAt}
        onChange={(e) => setTimeoutAt(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder={t("cidPlaceholder")}
        value={cid}
        onChange={(e) => setCid(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={onCreate} disabled={createDisabled}>
        {isPending ? t("sending") : t("createButton")}
      </button>
      {formError && <p style={{ color: "#c1121f" }}>{formError}</p>}

      <hr />
      <h3>{t("openDisputeSection")}</h3>
      <input
        placeholder={t("escrowPlaceholder")}
        value={escrowAddrForDispute}
        onChange={(e) => setEscrowAddrForDispute(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={onOpenDispute} disabled={isPending || isWrongChain}>
        {isPending ? t("sending") : t("openDisputeButton")}
      </button>

      <hr />
      <h3>{t("voteSection")}</h3>
      <input
        placeholder={t("disputeIdPlaceholder")}
        value={voteDisputeId}
        onChange={(e) => setVoteDisputeId(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder={t("sellerBpsPlaceholder")}
        value={sellerBps}
        onChange={(e) => setSellerBps(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={onVote} disabled={isPending || isWrongChain}>
        {isPending ? t("sending") : t("voteButton")}
      </button>

      <hr />
      <h3>{t("querySection")}</h3>
      <input
        placeholder={t("disputeIdPlaceholder")}
        value={disputeId}
        onChange={(e) => setDisputeId(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button onClick={() => disputeInfo.refetch()}>
        {t("refreshDispute")}
      </button>
      <pre
        style={{
          background: "#f6f6f6",
          padding: 12,
          borderRadius: 8,
          overflow: "auto",
        }}
      >
        {JSON.stringify(disputeSummary, null, 2)}
      </pre>

      {txHash && (
        <p>
          {t("txLabel")}
          {txHash}
        </p>
      )}
      {txHash && (
        <p>
          {t("txStatusLabel")}
          {txReceipt.isLoading
            ? t("txPending")
            : txReceipt.isSuccess
              ? t("txSuccess")
              : txReceipt.isError
                ? t("txError")
                : t("txIdle")}
        </p>
      )}
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
