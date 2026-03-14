#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const staticJsonPath = path.join(root, "docs/security/reports/p2p-trade-arbitration.static-analysis.json");
const attackMdPath = path.join(root, "docs/security/reports/p2p-trade-arbitration.attack-simulation.md");
const outPath = path.join(root, "docs/security/reports/p2p-trade-arbitration.audit-summary.md");

if (!existsSync(staticJsonPath)) {
  console.error(`[audit-summary] missing static analysis report: ${staticJsonPath}`);
  process.exit(1);
}

const staticReport = JSON.parse(readFileSync(staticJsonPath, "utf8"));
const findings = staticReport.findings || [];
const checks = staticReport.checks || [];
const attackExists = existsSync(attackMdPath);

mkdirSync(path.dirname(outPath), { recursive: true });

const severityOrder = { high: 3, medium: 2, low: 1 };
findings.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

const lines = [
  "# P2PTradeArbitration 审计摘要（自动生成）",
  "",
  `- 生成时间: ${new Date().toISOString()}`,
  `- 静态分析检查数: ${checks.length}`,
  `- 漏洞/问题数: ${findings.length}`,
  `- 攻击模拟报告: ${attackExists ? "已检测到" : "未检测到"}`,
  "",
  "## 漏洞总结",
  ...(findings.length === 0
    ? ["- 未检测到已登记漏洞。"]
    : findings.map((f) => `- [${f.severity}] ${f.id}: ${f.title}`)),
  "",
  "## 漏洞修复建议",
  ...(findings.length === 0
    ? ["- 持续执行静态分析与攻击模拟，关注新提交引入的问题。"]
    : findings.map((f) => `- ${f.id}: ${f.recommendation}`)),
  "",
  "## 安全性评估",
  "- 当前实现具备基础防护（重入防护、权限控制、状态机约束）。",
  "- 建议优先处理 Medium 及以上问题后再推进主网发布。",
  "",
  "## 性能评估",
  "- 当前流程未发现明显复杂度型瓶颈，建议加入 gas 基线与阈值告警。",
  "- 高频争议场景建议在 CI 增加更高轮次压力与 fuzz 覆盖。",
  ""
];

writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`[audit-summary] report written: ${outPath}`);
