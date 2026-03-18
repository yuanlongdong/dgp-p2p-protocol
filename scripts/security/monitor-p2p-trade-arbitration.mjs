#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key.startsWith("--")) {
      args[key.slice(2)] = val;
      i += 1;
    }
  }
  return args;
}

async function rpcCall(rpcUrl, method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message}`);
  return payload.result;
}

function hexToInt(v) {
  return Number.parseInt(v || "0x0", 16);
}

function toLower(v) {
  return typeof v === "string" ? v.toLowerCase() : "";
}

const args = parseArgs(process.argv);
const rpcUrl = args.rpc || process.env.MONITOR_RPC_URL;
const contract = toLower(args.contract || process.env.P2P_ARBITRATION_ADDRESS || "");
const network = args.network || process.env.MONITOR_NETWORK || "unknown";
const windowBlocks = Number(args.windowBlocks || process.env.MONITOR_WINDOW_BLOCKS || 120);
const spikeThreshold = Number(args.spikeThreshold || process.env.MONITOR_TX_SPIKE_THRESHOLD || 50);
const failureThreshold = Number(args.failureThreshold || process.env.MONITOR_FAILURE_THRESHOLD || 3);
const strict = (process.env.MONITOR_STRICT || "0") === "1";

if (!rpcUrl || !contract) {
  console.error("Usage: node monitor-p2p-trade-arbitration.mjs --rpc <url> --contract <address> [--network <name>]");
  process.exit(2);
}

const now = new Date();
const reportDir = path.join(process.cwd(), "docs", "security", "reports", "runtime-monitoring");
mkdirSync(reportDir, { recursive: true });

try {
  const latestHex = await rpcCall(rpcUrl, "eth_blockNumber");
  const latest = hexToInt(latestHex);
  const start = Math.max(0, latest - windowBlocks + 1);

  let totalTxToContract = 0;
  let failedTxToContract = 0;
  let totalValueWei = 0n;
  const uniqueSenders = new Set();

  for (let block = start; block <= latest; block += 1) {
    const blockHex = `0x${block.toString(16)}`;
    const blk = await rpcCall(rpcUrl, "eth_getBlockByNumber", [blockHex, true]);
    const txs = blk?.transactions || [];
    for (const tx of txs) {
      if (toLower(tx.to) !== contract) continue;
      totalTxToContract += 1;
      uniqueSenders.add(toLower(tx.from));
      totalValueWei += BigInt(tx.value || "0x0");
      const receipt = await rpcCall(rpcUrl, "eth_getTransactionReceipt", [tx.hash]);
      if (hexToInt(receipt?.status) !== 1) failedTxToContract += 1;
    }
  }

  const anomalies = [];
  if (failedTxToContract >= failureThreshold) {
    anomalies.push({
      severity: failedTxToContract > failureThreshold * 2 ? "high" : "medium",
      code: "MONITOR-FAILED-TX",
      message: `Detected ${failedTxToContract} failed tx(s) to monitored contract in recent window.`
    });
  }
  if (totalTxToContract >= spikeThreshold) {
    anomalies.push({
      severity: "medium",
      code: "MONITOR-TX-SPIKE",
      message: `Transaction spike detected: ${totalTxToContract} tx(s) in ${windowBlocks} blocks (threshold ${spikeThreshold}).`
    });
  }
  if (totalValueWei > 0n) {
    anomalies.push({
      severity: "low",
      code: "MONITOR-NATIVE-VALUE",
      message: "Observed native token value sent to contract. Verify fallback/receive behavior and sender intent."
    });
  }
  if (totalTxToContract === 0) {
    anomalies.push({
      severity: "low",
      code: "MONITOR-IDLE-WINDOW",
      message: "No direct contract transactions were detected in the current window. Confirm event relays are still receiving EscrowCreated / TradeFunded / DisputeCreated / EscrowReleased activity from the expected integration path."
    });
  }

  const summary = {
    generatedAt: now.toISOString(),
    network,
    contract,
    blockRange: { from: start, to: latest, size: windowBlocks },
    monitoredSignals: [
      "TradeCreated / EscrowCreated",
      "TradeFunded / EscrowFunded",
      "DisputeCreated",
      "EscrowReleased",
      "DepositLocked / DepositSlashed"
    ],
    metrics: {
      totalTxToContract,
      failedTxToContract,
      uniqueSenders: uniqueSenders.size,
      totalNativeValueWei: totalValueWei.toString()
    },
    anomalies,
    status: anomalies.some((a) => a.severity === "high") ? "alert" : "ok"
  };

  const jsonPath = path.join(reportDir, `p2p-trade-arbitration.monitor.${network}.json`);
  const mdPath = path.join(reportDir, `p2p-trade-arbitration.monitor.${network}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

  const lines = [
    "# P2PTradeArbitration 运行时监控报告",
    "",
    `- 时间: ${summary.generatedAt}`,
    `- 网络: ${network}`,
    `- 合约: ${contract}`,
    `- 扫描区块: ${start} -> ${latest}（窗口 ${windowBlocks}）`,
    "",
    "## 监控信号",
    ...summary.monitoredSignals.map((signal) => `- ${signal}`),
    "",
    "## 指标",
    `- 合约交易数: ${totalTxToContract}`,
    `- 失败交易数: ${failedTxToContract}`,
    `- 唯一发送者: ${uniqueSenders.size}`,
    `- 原生币入金(wei): ${totalValueWei.toString()}`,
    "",
    "## 异常",
    ...(anomalies.length === 0
      ? ["- 未检测到异常。"]
      : anomalies.map((a) => `- [${a.severity}] ${a.code}: ${a.message}`)),
    "",
    "## 自动告警建议",
    "- 对 `MONITOR-FAILED-TX` 触发 Telegram / PagerDuty 告警并附带最近失败交易哈希。",
    "- 对 `MONITOR-TX-SPIKE` 结合押金异常、争议集中度和风控白名单做二次确认。",
    "- 每日与每周审计任务应复用本报告输出并归档到 `docs/security/reports/runtime-monitoring/`。"
  ];

  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  console.log(`[monitor] report written: ${jsonPath}`);
  console.log(`[monitor] report written: ${mdPath}`);

  if (strict && anomalies.length > 0) {
    console.error("[monitor] strict mode failed due to anomalies");
    process.exit(1);
  }
} catch (err) {
  console.error(`[monitor] failed: ${String(err)}`);
  process.exit(1);
}
