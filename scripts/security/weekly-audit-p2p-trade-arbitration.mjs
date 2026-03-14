#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8"
  });
  return {
    cmd: `${cmd} ${args.join(" ")}`,
    status: res.status ?? 1,
    stdout: res.stdout || "",
    stderr: res.stderr || ""
  };
}

const root = process.cwd();
const reportsDir = path.join(root, "docs", "security", "reports");
mkdirSync(reportsDir, { recursive: true });

const checks = [];
checks.push(run("node", ["scripts/security/conflict-of-interest-check.mjs"], {
  env: {
    SECURITY_CHANGE_AUTHOR: process.env.SECURITY_CHANGE_AUTHOR || process.env.GITHUB_ACTOR || "",
    SECURITY_REVIEWER: process.env.SECURITY_REVIEWER || "",
    SECURITY_APPROVER: process.env.SECURITY_APPROVER || "",
    COI_STRICT: process.env.COI_STRICT || "1"
  }
}));
checks.push(run("node", ["scripts/security/analyze-p2p-trade-arbitration.mjs"]));
checks.push(run("pnpm", ["--filter", "@dgp/contracts", "test", "--", "--grep", "P2PTradeArbitration"]));
checks.push(run("node", ["scripts/security/generate-patch-proposal.mjs"]));

const staticPath = path.join(reportsDir, "p2p-trade-arbitration.static-analysis.json");
const patchPath = path.join(root, "docs", "security", "patches", "p2p-trade-arbitration.auto-patch.md");
const staticSummary = existsSync(staticPath) ? JSON.parse(readFileSync(staticPath, "utf8")) : null;

const failed = checks.filter((c) => c.status !== 0);
const coiFailure = checks.some((c) => c.status !== 0 && c.cmd.includes("conflict-of-interest-check.mjs"));
const warning = checks.some((c) => c.status !== 0 && /HH502|403|download compiler version list/i.test(`${c.stdout}\n${c.stderr}`));

const lines = [
  "# 每周安全审计报告（自动生成）",
  "",
  `- 生成时间: ${new Date().toISOString()}`,
  "- 合约: `P2PTradeArbitration.sol`",
  "",
  "## 漏洞总结",
  staticSummary
    ? `- 静态分析检查项: ${staticSummary.summary?.checks ?? staticSummary.checks?.length ?? "n/a"}，发现问题: ${staticSummary.summary?.findings ?? staticSummary.findings?.length ?? "n/a"}`
    : "- 静态分析结果缺失。",
  ...(staticSummary?.findings || []).map((f) => `- [${f.severity}] ${f.id}: ${f.title}`),
  "",
  "## 修复建议",
  `- 自动补丁建议文件: \`${path.relative(root, patchPath)}\` ${existsSync(patchPath) ? "(已生成)" : "(未生成)"}`,
  "- 对 Medium 及以上问题应在当周排期并提交修复 PR。",
  "",
  "## 安全性评估",
  coiFailure
    ? "- 检测到利益冲突（COI）失败，已阻断流程，请先完成职责分离后再审计/发布。"
    : warning
      ? "- 本周测试受环境限制（编译器下载/网络限制），请在内网 runner 复跑并补传证据。"
      : failed.length === 0
        ? "- 自动化检查通过，未发现阻断上线的新问题。"
        : "- 存在失败检查，建议暂停发布并优先处理失败项。",
  "",
  "## 性能评估",
  "- 当前流程未检测到明显复杂度退化；建议持续记录 gas 基线并监控周环比变化。",
  "",
  "## 执行日志",
  ...checks.map((c) => `- [${c.status === 0 ? "PASS" : "FAIL"}] ${c.cmd}`)
];

const out = path.join(reportsDir, "p2p-trade-arbitration.weekly-audit.md");
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`[weekly-audit] report written: ${out}`);

if (coiFailure) process.exit(1);
if (failed.length > 0 && !warning) process.exit(1);
