import React, { CSSProperties, useMemo, useState } from "react";
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
  useWriteContract
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

type Locale = "zh-CN" | "en";

type SectionKey = "create" | "dispute" | "vote" | "query";

const translations: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    appTitle: "DGP-P2P Web（阶段 9）",
    heroBadge: "链上托管 · 争议仲裁 · Telegram 协同",
    heroTitle: "更清晰的托管操作台",
    heroSubtitle: "统一查看钱包、网络、合约配置与争议状态，并快速完成创建托管、发起争议和投票。",
    walletLabel: "钱包",
    walletConnected: "已连接 {address}",
    walletDisconnected: "未连接",
    networkLabel: "网络",
    networkUnknown: "-",
    networkRightSuffix: "（正确）",
    networkWrongSuffix: "（错误链）",
    connectWallet: "连接钱包",
    connecting: "连接中...",
    disconnectWallet: "断开钱包",
    switchChain: "切换到 Arbitrum Sepolia",
    switching: "切链中...",
    wrongChainWarning: "当前链不正确，已阻止交易操作。",
    factoryLabel: "工厂合约",
    disputeLabel: "争议合约",
    nextEscrowIdLabel: "下一个 EscrowId",
    notSet: "未配置",
    loading: "读取中...",
    createSection: "创建 Escrow",
    createDescription: "填写卖家、资产和截止时间后发起链上托管。",
    sellerPlaceholder: "卖家地址 0x...",
    tokenPlaceholder: "代币地址 0x...",
    amountPlaceholder: "数量",
    timeoutPlaceholder: "截止时间（Unix）",
    cidPlaceholder: "证据 CID",
    createButton: "创建托管",
    sending: "发送中...",
    openDisputeSection: "发起争议",
    openDisputeDescription: "输入托管地址后直接开启争议流程。",
    escrowPlaceholder: "托管地址 0x...",
    openDisputeButton: "发起争议",
    voteSection: "争议投票",
    voteDescription: "为争议输入仲裁比例，快速提交投票。",
    disputeIdPlaceholder: "争议 ID",
    sellerBpsPlaceholder: "卖家比例 BPS（0~10000）",
    voteButton: "提交投票",
    querySection: "查询争议",
    queryDescription: "查询争议进度、票数与卖家比例。",
    refreshDispute: "刷新争议状态",
    txLabel: "交易",
    txStatusLabel: "交易状态",
    txPending: "确认中...",
    txSuccess: "已上链",
    txError: "失败",
    txIdle: "等待提交",
    resolved: "已裁决",
    resolving: "处理中",
    disputeEscrow: "托管地址",
    disputeVotes: "票数",
    disputeSellerBps: "卖家比例",
    summaryWallet: "钱包状态",
    summaryContracts: "合约配置",
    summaryActions: "可执行操作",
    summaryActionsValue: "创建 / 争议 / 投票 / 查询",
    statusHealthy: "正常",
    statusAttention: "需处理",
    statusDisconnected: "未连接",
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
    helperFactoryMissing: "配置缺失：请填写 VITE_ESCROW_FACTORY 后再创建托管。",
    helperDisputeMissing: "配置缺失：请填写 VITE_DISPUTE_MODULE 后再执行争议操作。",
    helperCreateReady: "参数通过基础校验，可以直接发起创建。",
    helperCreateInvalid: "请补全并修正创建托管表单。",
    helperDisputeReady: "可直接提交争议申请。",
    helperVoteReady: "仲裁比例合法，可直接提交投票。",
    helperQuery: "输入 disputeId 并点击刷新获取链上最新状态。",
    panelConfig: "环境配置",
    panelActions: "操作面板",
    panelQuery: "争议快照",
    lastTxTitle: "最近交易",
    noTxYet: "尚未发起交易",
    networkName: "Arbitrum Sepolia"
  },
  en: {
    appTitle: "DGP-P2P Web (Phase 9)",
    heroBadge: "On-chain escrow · dispute module · Telegram workflow",
    heroTitle: "A cleaner escrow operations console",
    heroSubtitle: "Track wallet, network, contract settings, and dispute state in one place while creating escrows and handling arbitration faster.",
    walletLabel: "Wallet",
    walletConnected: "Connected {address}",
    walletDisconnected: "Disconnected",
    networkLabel: "Network",
    networkUnknown: "-",
    networkRightSuffix: " (ok)",
    networkWrongSuffix: " (wrong)",
    connectWallet: "Connect Wallet",
    connecting: "Connecting...",
    disconnectWallet: "Disconnect",
    switchChain: "Switch to Arbitrum Sepolia",
    switching: "Switching...",
    wrongChainWarning: "Wrong network. Transactions are blocked.",
    factoryLabel: "Factory",
    disputeLabel: "Dispute",
    nextEscrowIdLabel: "nextEscrowId",
    notSet: "NOT_SET",
    loading: "Loading...",
    createSection: "Create Escrow",
    createDescription: "Fill seller, asset, and timeout settings to create a new on-chain escrow.",
    sellerPlaceholder: "seller 0x...",
    tokenPlaceholder: "token 0x...",
    amountPlaceholder: "amount",
    timeoutPlaceholder: "timeoutAt (Unix)",
    cidPlaceholder: "evidence CID",
    createButton: "Create Escrow",
    sending: "Sending...",
    openDisputeSection: "Open Dispute",
    openDisputeDescription: "Start a dispute flow directly from an escrow address.",
    escrowPlaceholder: "escrow address 0x...",
    openDisputeButton: "Open Dispute",
    voteSection: "Vote Dispute",
    voteDescription: "Submit the seller ratio and record an arbitration vote quickly.",
    disputeIdPlaceholder: "disputeId",
    sellerBpsPlaceholder: "sellerBps (0~10000)",
    voteButton: "Submit Vote",
    querySection: "Query Dispute",
    queryDescription: "Inspect resolution status, votes, and seller allocation.",
    refreshDispute: "Refresh dispute state",
    txLabel: "Tx",
    txStatusLabel: "Tx Status",
    txPending: "Confirming...",
    txSuccess: "Confirmed",
    txError: "Failed",
    txIdle: "Waiting",
    resolved: "Resolved",
    resolving: "Pending",
    disputeEscrow: "Escrow",
    disputeVotes: "Votes",
    disputeSellerBps: "Seller ratio",
    summaryWallet: "Wallet state",
    summaryContracts: "Contract setup",
    summaryActions: "Actions",
    summaryActionsValue: "Create / dispute / vote / query",
    statusHealthy: "Healthy",
    statusAttention: "Needs attention",
    statusDisconnected: "Disconnected",
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
    helperFactoryMissing: "Missing setup: configure VITE_ESCROW_FACTORY before creating escrows.",
    helperDisputeMissing: "Missing setup: configure VITE_DISPUTE_MODULE before dispute actions.",
    helperCreateReady: "Inputs look valid and ready for submission.",
    helperCreateInvalid: "Complete and fix the create-escrow form before sending.",
    helperDisputeReady: "Escrow address is ready for dispute submission.",
    helperVoteReady: "Arbitration ratio is valid and ready to submit.",
    helperQuery: "Enter a disputeId and refresh to load the latest on-chain snapshot.",
    panelConfig: "Environment",
    panelActions: "Action panels",
    panelQuery: "Dispute snapshot",
    lastTxTitle: "Latest transaction",
    noTxYet: "No transaction submitted yet",
    networkName: "Arbitrum Sepolia"
  }
};

const resolveLocale = (): Locale => {
  const envLang = (import.meta as any).env?.VITE_LANG as string | undefined;
  const raw = (envLang || "zh-CN").toLowerCase();
  return raw.startsWith("en") ? "en" : "zh-CN";
};

const t = (key: string, params: Record<string, string | number> = {}) => {
  const locale = resolveLocale();
  const template = translations[locale][key] ?? translations["zh-CN"][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
};

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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #081124 0%, #101a31 42%, #f5f7fb 42%, #eef2f8 100%)",
    color: "#101828",
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "32px 20px 48px"
  },
  shell: {
    maxWidth: 1180,
    margin: "0 auto"
  },
  hero: {
    background: "radial-gradient(circle at top right, rgba(110, 168, 254, 0.32), transparent 30%), linear-gradient(135deg, #08162b 0%, #15284b 55%, #1e3a70 100%)",
    color: "#f8fafc",
    borderRadius: 28,
    padding: "28px 28px 32px",
    boxShadow: "0 24px 60px rgba(8, 18, 36, 0.35)",
    marginBottom: 24,
    border: "1px solid rgba(148, 163, 184, 0.14)"
  },
  heroBadge: {
    display: "inline-flex",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 16
  },
  heroTitle: {
    fontSize: "clamp(2rem, 5vw, 3.25rem)",
    lineHeight: 1.05,
    margin: "0 0 12px"
  },
  heroSubtitle: {
    maxWidth: 760,
    margin: 0,
    color: "rgba(248, 250, 252, 0.8)",
    fontSize: 16,
    lineHeight: 1.7
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    margin: "24px 0"
  },
  summaryCard: {
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(6px)"
  },
  summaryLabel: {
    color: "rgba(226, 232, 240, 0.75)",
    fontSize: 13,
    marginBottom: 8
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 700,
    wordBreak: "break-all"
  },
  summaryActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16
  },
  button: {
    appearance: "none",
    border: "none",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
    background: "linear-gradient(135deg, #7c9cff 0%, #5b8cff 100%)",
    color: "#fff",
    boxShadow: "0 14px 28px rgba(91, 140, 255, 0.28)"
  },
  secondaryButton: {
    appearance: "none",
    border: "1px solid rgba(148, 163, 184, 0.24)",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
    background: "rgba(255,255,255,0.9)",
    color: "#0f172a"
  },
  banner: {
    marginTop: 18,
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(248, 113, 113, 0.12)",
    border: "1px solid rgba(248, 113, 113, 0.25)",
    color: "#fecaca"
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)",
    gap: 20,
    alignItems: "start"
  },
  stack: {
    display: "grid",
    gap: 18
  },
  card: {
    background: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    padding: 22,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.08)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a"
  },
  cardText: {
    margin: "8px 0 0",
    color: "#475467",
    fontSize: 14,
    lineHeight: 1.65
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3b4db8",
    fontWeight: 700,
    fontSize: 12
  },
  fields: {
    display: "grid",
    gap: 12
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #d0d5dd",
    background: "#fff",
    color: "#101828",
    fontSize: 14,
    outline: "none"
  },
  helper: {
    margin: "12px 0 0",
    color: "#667085",
    fontSize: 13,
    lineHeight: 1.6
  },
  error: {
    margin: "12px 0 0",
    color: "#b42318",
    fontWeight: 600
  },
  metaList: {
    display: "grid",
    gap: 12
  },
  metaItem: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  metaLabel: {
    fontSize: 12,
    color: "#667085",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  metaValue: {
    fontWeight: 700,
    color: "#0f172a",
    wordBreak: "break-all"
  },
  snapshot: {
    background: "#0f172a",
    color: "#dbeafe",
    borderRadius: 18,
    padding: 18,
    overflow: "auto",
    fontSize: 13,
    lineHeight: 1.7,
    marginTop: 16
  },
  txPanel: {
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
    border: "1px solid #dbeafe"
  }
};

const shortHash = (value: string, left = 8, right = 6) => {
  if (!value) return value;
  return value.length <= left + right + 3 ? value : `${value.slice(0, left)}...${value.slice(-right)}`;
};

function StatusChip({ status }: { status: string }) {
  return <span style={styles.chip}>{status}</span>;
}

function PanelCard(props: {
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}) {
  const { title, description, badge, children } = props;
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.cardTitle}>{title}</h3>
          <p style={styles.cardText}>{description}</p>
        </div>
        <StatusChip status={badge} />
      </div>
      {children}
    </section>
  );
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
    if (!factory) return alert(t("alertNeedFactory"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
    const parsedAmount = parseUint(amount);
    const parsedTimeout = parseUint(timeoutAt);
    if (!isAddress(seller)) return setFormError(t("errorInvalidSeller"));
    if (!isAddress(token)) return setFormError(t("errorInvalidToken"));
    if (parsedAmount === null || parsedAmount <= 0n) return setFormError(t("errorInvalidAmount"));
    if (parsedTimeout === null || parsedTimeout <= BigInt(Math.floor(Date.now() / 1000))) {
      return setFormError(t("errorInvalidTimeout"));
    }
    if (!cid.trim()) return setFormError(t("errorInvalidCid"));
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
    if (!dispute) return alert(t("alertNeedDispute"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
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
    if (!dispute) return alert(t("alertNeedDispute"));
    if (!isConnected) return alert(t("alertNeedWallet"));
    if (isWrongChain) return alert(t("alertWrongChain"));
    const voteBps = Number(sellerBps);
    if (Number.isNaN(voteBps) || voteBps < 0 || voteBps > 10000) {
      return alert(t("errorInvalidSellerBps"));
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
        resolved: disputeInfo.data[1] ? t("resolved") : t("resolving"),
        sellerBps: Number(disputeInfo.data[2]),
        votes: Number(disputeInfo.data[3])
      }
    : null;

  const parsedAmount = parseUint(amount);
  const parsedTimeout = parseUint(timeoutAt);
  const createInvalid =
    !isAddress(seller) ||
    !isAddress(token) ||
    parsedAmount === null ||
    parsedAmount <= 0n ||
    parsedTimeout === null ||
    parsedTimeout <= BigInt(Math.floor(Date.now() / 1000)) ||
    !cid.trim();

  const createDisabled = isPending || !isConnected || isWrongChain || !factory || createInvalid;
  const disputeReady = isAddress(escrowAddrForDispute);
  const voteBps = Number(sellerBps);
  const voteReady = Number.isFinite(voteBps) && voteBps >= 0 && voteBps <= 10000;

  const walletStatus = useMemo(() => {
    if (!isConnected) return t("statusDisconnected");
    return isWrongChain ? t("statusAttention") : t("statusHealthy");
  }, [isConnected, isWrongChain]);

  const actionBadges: Record<SectionKey, string> = {
    create: !factory ? t("statusAttention") : createDisabled ? t("statusAttention") : t("statusHealthy"),
    dispute: !dispute ? t("statusAttention") : disputeReady ? t("statusHealthy") : t("statusAttention"),
    vote: !dispute ? t("statusAttention") : voteReady ? t("statusHealthy") : t("statusAttention"),
    query: t("statusHealthy")
  };

  const createHelper = !factory
    ? t("helperFactoryMissing")
    : createInvalid
      ? t("helperCreateInvalid")
      : t("helperCreateReady");
  const disputeHelper = !dispute
    ? t("helperDisputeMissing")
    : disputeReady
      ? t("helperDisputeReady")
      : t("helperCreateInvalid");
  const voteHelper = !dispute
    ? t("helperDisputeMissing")
    : voteReady
      ? t("helperVoteReady")
      : t("errorInvalidSellerBps");

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <span style={styles.heroBadge}>{t("heroBadge")}</span>
          <h1 style={styles.heroTitle}>{t("heroTitle")}</h1>
          <p style={styles.heroSubtitle}>{t("heroSubtitle")}</p>

          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{t("summaryWallet")}</div>
              <div style={styles.summaryValue}>{isConnected ? shortHash(address || "") : t("walletDisconnected")}</div>
              <p style={styles.cardText}>{walletStatus}</p>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{t("networkLabel")}</div>
              <div style={styles.summaryValue}>
                {isConnected ? `${t("networkName")} · ${chainId}${isWrongChain ? t("networkWrongSuffix") : t("networkRightSuffix")}` : t("networkUnknown")}
              </div>
              <p style={styles.cardText}>{t("networkName")}</p>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{t("summaryContracts")}</div>
              <div style={styles.summaryValue}>{factory && dispute ? t("statusHealthy") : t("statusAttention")}</div>
              <p style={styles.cardText}>{`${t("factoryLabel")}: ${factory ? shortHash(factory) : t("notSet")}`}</p>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{t("summaryActions")}</div>
              <div style={styles.summaryValue}>{t("summaryActionsValue")}</div>
              <p style={styles.cardText}>{`${t("nextEscrowIdLabel")}: ${nextEscrow.isLoading ? t("loading") : String(nextEscrow.data ?? "-")}`}</p>
            </div>
          </div>

          <div style={styles.summaryActions}>
            {!isConnected ? (
              <button onClick={() => connect({ connector: injected() })} disabled={isConnectPending} style={styles.button}>
                {isConnectPending ? t("connecting") : t("connectWallet")}
              </button>
            ) : (
              <button onClick={() => disconnect()} style={styles.secondaryButton}>{t("disconnectWallet")}</button>
            )}
            {isWrongChain && (
              <button
                onClick={async () => {
                  await switchChainAsync({ chainId: targetChainId });
                }}
                disabled={isSwitchPending}
                style={styles.button}
              >
                {isSwitchPending ? t("switching") : t("switchChain")}
              </button>
            )}
          </div>

          {isWrongChain && <div style={styles.banner}>{t("wrongChainWarning")}</div>}
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.stack}>
            <PanelCard title={t("createSection")} description={t("createDescription")} badge={actionBadges.create}>
              <div style={styles.fields}>
                <input placeholder={t("sellerPlaceholder")} value={seller} onChange={(e) => setSeller(e.target.value)} style={styles.input} />
                <input placeholder={t("tokenPlaceholder")} value={token} onChange={(e) => setToken(e.target.value)} style={styles.input} />
                <input placeholder={t("amountPlaceholder")} value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} />
                <input placeholder={t("timeoutPlaceholder")} value={timeoutAt} onChange={(e) => setTimeoutAt(e.target.value)} style={styles.input} />
                <input placeholder={t("cidPlaceholder")} value={cid} onChange={(e) => setCid(e.target.value)} style={styles.input} />
                <button onClick={onCreate} disabled={createDisabled} style={styles.button}>{isPending ? t("sending") : t("createButton")}</button>
              </div>
              <p style={styles.helper}>{createHelper}</p>
              {formError && <p style={styles.error}>{formError}</p>}
            </PanelCard>

            <PanelCard title={t("openDisputeSection")} description={t("openDisputeDescription")} badge={actionBadges.dispute}>
              <div style={styles.fields}>
                <input placeholder={t("escrowPlaceholder")} value={escrowAddrForDispute} onChange={(e) => setEscrowAddrForDispute(e.target.value)} style={styles.input} />
                <button onClick={onOpenDispute} disabled={isPending || isWrongChain || !disputeReady} style={styles.button}>
                  {isPending ? t("sending") : t("openDisputeButton")}
                </button>
              </div>
              <p style={styles.helper}>{disputeHelper}</p>
            </PanelCard>

            <PanelCard title={t("voteSection")} description={t("voteDescription")} badge={actionBadges.vote}>
              <div style={styles.fields}>
                <input placeholder={t("disputeIdPlaceholder")} value={voteDisputeId} onChange={(e) => setVoteDisputeId(e.target.value)} style={styles.input} />
                <input placeholder={t("sellerBpsPlaceholder")} value={sellerBps} onChange={(e) => setSellerBps(e.target.value)} style={styles.input} />
                <button onClick={onVote} disabled={isPending || isWrongChain || !voteReady} style={styles.button}>
                  {isPending ? t("sending") : t("voteButton")}
                </button>
              </div>
              <p style={styles.helper}>{voteHelper}</p>
            </PanelCard>
          </div>

          <div style={styles.stack}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>{t("panelConfig")}</h3>
                  <p style={styles.cardText}>{t("panelActions")}</p>
                </div>
                <StatusChip status={walletStatus} />
              </div>
              <div style={styles.metaList}>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>{t("walletLabel")}</div>
                  <div style={styles.metaValue}>{isConnected ? t("walletConnected", { address: address || "" }) : t("walletDisconnected")}</div>
                </div>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>{t("networkLabel")}</div>
                  <div style={styles.metaValue}>{isConnected ? `${chainId}${isWrongChain ? t("networkWrongSuffix") : t("networkRightSuffix")}` : t("networkUnknown")}</div>
                </div>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>{t("factoryLabel")}</div>
                  <div style={styles.metaValue}>{factory || t("notSet")}</div>
                </div>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>{t("disputeLabel")}</div>
                  <div style={styles.metaValue}>{dispute || t("notSet")}</div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>{t("querySection")}</h3>
                  <p style={styles.cardText}>{t("queryDescription")}</p>
                </div>
                <StatusChip status={actionBadges.query} />
              </div>
              <div style={styles.fields}>
                <input placeholder={t("disputeIdPlaceholder")} value={disputeId} onChange={(e) => setDisputeId(e.target.value)} style={styles.input} />
                <button onClick={() => disputeInfo.refetch()} style={styles.secondaryButton}>{t("refreshDispute")}</button>
              </div>
              <p style={styles.helper}>{t("helperQuery")}</p>
              <div style={styles.snapshot}>
                {JSON.stringify(disputeSummary, null, 2)}
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.cardTitle}>{t("panelQuery")}</h3>
                  <p style={styles.cardText}>{t("lastTxTitle")}</p>
                </div>
                <StatusChip status={txHash ? (txReceipt.isSuccess ? t("txSuccess") : txReceipt.isLoading ? t("txPending") : txReceipt.isError ? t("txError") : t("txIdle")) : t("txIdle")} />
              </div>

              {disputeSummary ? (
                <div style={styles.metaList}>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>{t("disputeEscrow")}</div>
                    <div style={styles.metaValue}>{String(disputeSummary.escrow)}</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>{t("txStatusLabel")}</div>
                    <div style={styles.metaValue}>{String(disputeSummary.resolved)}</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>{t("disputeSellerBps")}</div>
                    <div style={styles.metaValue}>{String(disputeSummary.sellerBps)}</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>{t("disputeVotes")}</div>
                    <div style={styles.metaValue}>{String(disputeSummary.votes)}</div>
                  </div>
                </div>
              ) : (
                <p style={styles.helper}>{t("helperQuery")}</p>
              )}

              <div style={{ ...styles.txPanel, marginTop: 16 }}>
                <div style={styles.metaLabel}>{t("lastTxTitle")}</div>
                <div style={styles.metaValue}>{txHash || t("noTxYet")}</div>
                {txHash && (
                  <p style={{ ...styles.cardText, marginTop: 10 }}>
                    {t("txStatusLabel")}: {txReceipt.isLoading ? t("txPending") : txReceipt.isSuccess ? t("txSuccess") : txReceipt.isError ? t("txError") : t("txIdle")}
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>
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
