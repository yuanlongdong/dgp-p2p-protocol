#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const target = "packages/contracts/contracts/P2PTradeArbitration.sol";
const outJson = "docs/security/reports/p2p-trade-arbitration.static-analysis.json";

const src = readFileSync(target, "utf8");

function has(re) {
  return re.test(src);
}

const report = {
  tool: "custom-static-analyzer",
  target,
  generatedAt: new Date().toISOString(),
  summary: { checks: 0, findings: 0 },
  checks: [],
  findings: []
};

function addCheck(name, passed, details) {
  report.checks.push({ name, passed, details });
}

for (const fn of [
  "fundTrade",
  "lockDeposit",
  "releaseDeposit",
  "slashDeposit",
  "releaseEscrow",
  "refundEscrow",
  "resolveDispute"
]) {
  const re = new RegExp(`function\\s+${fn}\\([^)]*\\)\\s+(public|external)\\s+[^\\n]*nonReentrant`);
  addCheck(`reentrancy-guard:${fn}`, has(re), "Value-moving functions should use nonReentrant.");
}

addCheck(
  "solidity-version-overflow-check",
  has(/pragma solidity \^0\.8\./),
  "Solidity >=0.8 provides checked arithmetic by default."
);

for (const fn of [
  "setArbitrator",
  "setVoteDuration",
  "setAppealDuration",
  "setMinVotesToResolve",
  "setSlashBps",
  "pause",
  "unpause"
]) {
  const re = new RegExp(`function\\s+${fn}\\([^)]*\\)\\s+external\\s+onlyOwner`);
  addCheck(`access-control:${fn}`, has(re), "Administrative functions should be owner protected.");
}

addCheck(
  "multi-stage-arbitration",
  has(/enum ArbitrationStage/) && has(/DisputeStageAdvanced/) && has(/advanceDisputeStage/),
  "Disputes should support explicit multi-stage progression."
);
addCheck(
  "vote-bps-recording",
  has(/function vote\(uint256 disputeId, uint16 sellerBps\)/) && has(/finalSellerBps/),
  "Arbitrators should be able to vote with seller basis points for split settlements."
);
addCheck(
  "deposit-risk-controls",
  has(/function lockDeposit\(/) && has(/function releaseDeposit\(/) && has(/function slashDeposit\(/),
  "Dynamic deposit lifecycle should be implemented."
);
addCheck(
  "reputation-model",
  has(/struct ReputationMetrics/) && has(/function updateReputation\(/) && has(/getRequiredDepositBps/),
  "Reputation should drive fees, deposits, and trade limits."
);
addCheck(
  "monitoring-events",
  has(/event TradeCreated/) && has(/event TradeFunded/) && has(/event DisputeCreated/) && has(/event EscrowReleased/),
  "Expected monitoring events should exist for ops automation."
);

if (!has(/settlementToken\.safeTransferFrom\(msg\.sender, address\(this\), trade\.amount\)/)) {
  report.findings.push({
    id: "LOGIC-001",
    severity: "medium",
    category: "logic",
    title: "Escrow funding path changed unexpectedly",
    description: "The analyzer could not confirm the expected escrow funding transfer path.",
    recommendation: "Verify fundTrade still transfers the exact escrow amount into the contract."
  });
}

if (!has(/require\(_canOpenTrade\(msg\.sender, trade\.amount \+ requiredDeposit\), \"trade-limit\"\);/)) {
  report.findings.push({
    id: "RISK-001",
    severity: "medium",
    category: "risk-control",
    title: "Deposit lock may not enforce exposure limits",
    description: "The analyzer could not confirm that deposit locking checks active exposure against trade amount plus deposit.",
    recommendation: "Ensure low-reputation users cannot over-extend by bypassing deposit-time exposure checks."
  });
}

if (!has(/require\(dispute\.voteCount >= minVotesToResolve, \"appeal-required\"\);/) || !has(/require\(block\.timestamp > dispute\.finalDeadline, \"appeal-active\"\);/)) {
  report.findings.push({
    id: "ARBITRATION-001",
    severity: "low",
    category: "workflow",
    title: "Appeal stage guards missing or weakened",
    description: "The analyzer could not fully verify the primary-vote to appeal transition requirements.",
    recommendation: "Keep explicit guards for `appeal-required` and `appeal-active` so disputes cannot skip stages."
  });
}

report.summary.checks = report.checks.length;
report.summary.findings = report.findings.length;

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(report, null, 2) + "\n");

console.log(`Static analysis finished. checks=${report.checks.length}, findings=${report.findings.length}`);
for (const f of report.findings) {
  console.log(`- [${f.severity}] ${f.id} ${f.title}`);
}
