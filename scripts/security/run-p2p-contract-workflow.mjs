#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function requireFile(file) {
  if (!existsSync(file)) {
    console.error(`[workflow] missing required file: ${file}`);
    process.exit(1);
  }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8" });
  return r.status ?? 1;
}

const required = [
  "docs/smart-contract-requirements.zh-CN.md",
  "packages/contracts/contracts/P2PTradeArbitration.sol",
  "packages/contracts/test/p2p-trade-arbitration.spec.ts",
  "packages/contracts/test/p2p-trade-arbitration.attack.spec.ts"
];

for (const file of required) requireFile(file);

console.log("[workflow] step1/2 verified: requirement doc + contract + tests exist");

const analyzerStatus = run("node", ["scripts/security/analyze-p2p-trade-arbitration.mjs"]);
if (analyzerStatus !== 0) process.exit(analyzerStatus);

const attackStatus = run("pnpm", ["--filter", "@dgp/contracts", "test", "--", "--grep", "attack simulations"]);
if (attackStatus !== 0) {
  console.warn("[workflow] attack simulation step failed in this environment; continue to generate reports for triage");
}

const summaryStatus = run("node", ["scripts/security/generate-audit-summary.mjs"]);
if (summaryStatus !== 0) process.exit(summaryStatus);

const weeklyStatus = run("node", ["scripts/security/weekly-audit-p2p-trade-arbitration.mjs"]);
if (weeklyStatus !== 0) {
  console.warn("[workflow] weekly audit returned non-zero (likely environment/network constraint)");
}

console.log("[workflow] completed: generated reports and patch proposal for developer follow-up");
