#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticJson = path.join(root, "docs", "security", "reports", "p2p-trade-arbitration.static-analysis.json");
const monitorJson = path.join(
  root,
  "docs",
  "security",
  "reports",
  "runtime-monitoring",
  `p2p-trade-arbitration.monitor.${process.env.MONITOR_NETWORK || "unknown"}.json`
);

if (!existsSync(staticJson)) {
  console.error(`[patch] missing static analysis report: ${staticJson}`);
  process.exit(1);
}

const staticReport = JSON.parse(readFileSync(staticJson, "utf8"));
const monitorReport = existsSync(monitorJson) ? JSON.parse(readFileSync(monitorJson, "utf8")) : null;
const findings = staticReport.findings || [];

const patchDir = path.join(root, "docs", "security", "patches");
mkdirSync(patchDir, { recursive: true });
const out = path.join(patchDir, "p2p-trade-arbitration.auto-patch.md");

const lines = [
  "# P2PTradeArbitration 自动补丁建议",
  "",
  `- 生成时间: ${new Date().toISOString()}`,
  "- 来源: 静态分析 + 运行时监控",
  "",
  "## 待修复项",
  ""
];

if (findings.length === 0 && (!monitorReport || (monitorReport.anomalies || []).length === 0)) {
  lines.push("- 当前未发现需要自动生成补丁的项目。", "");
} else {
  for (const f of findings) {
    if (f.id === "LOGIC-001") {
      lines.push(
        "### LOGIC-001: Fee-on-transfer 兼容修复",
        "- 在 `fundTrade` 中增加前后余额差分：`received = after - before`。",
        "- 将托管金额改为 `received`，避免按名义金额结算导致余额不足。",
        "- 事件新增 `quotedAmount` 与 `receivedAmount` 字段。",
        "- 同步补充 fee-on-transfer 单测覆盖。",
        ""
      );
    }
    if (f.id === "LOGIC-002") {
      lines.push(
        "### LOGIC-002: 0票结案策略定版",
        "- 方案A（公平优先）: 在 fallback 前增加 `require(totalVotes > 0, \"no-votes\")`。",
        "- 方案B（可用性优先）: 保留自动退款但新增 `DisputeAutoResolvedNoVotes` 事件并接入告警。",
        "- 根据治理策略二选一并补齐测试。",
        ""
      );
    }
  }

  if (monitorReport) {
    for (const a of monitorReport.anomalies || []) {
      lines.push(
        `### Runtime: ${a.code}`,
        `- 严重级别: ${a.severity}`,
        `- 处理建议: ${a.message}`,
        "- 立即行动: 将对应交易哈希加入复盘清单，并在下个迭代安排修复。",
        ""
      );
    }
  }
}

lines.push(
  "## 推送给开发人员",
  "- CI 可将本文件作为 artifact 上传，并通过 Issue/PR comment 自动分发给开发负责人。",
  "- 建议将高危与中危项设为阻断发布条件。",
  ""
);

writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`[patch] proposal written: ${out}`);
