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
  checks: [],
  findings: []
};

function addCheck(name, passed, details) {
  report.checks.push({ name, passed, details });
}

// 1) Reentrancy defensive checks
const transferFns = ["fundTrade", "releaseTrade", "refundAfterDeadline", "resolveDispute"];
for (const fn of transferFns) {
  const re = new RegExp(`function\\s+${fn}\\([^)]*\\)\\s+external\\s+nonReentrant`);
  addCheck(`reentrancy-guard:${fn}`, has(re), "Token transfer related external functions should use nonReentrant.");
}

// 2) Arithmetic safety checks
addCheck("solidity-version-overflow-check", has(/pragma solidity \^0\.8\./), "Solidity >=0.8 has built-in overflow/underflow checks.");

// 3) Access control checks
for (const fn of ["setArbitrator", "setVoteDuration", "setMinVotesToResolve", "pause", "unpause"]) {
  const re = new RegExp(`function\\s+${fn}\\([^)]*\\)\\s+external\\s+onlyOwner`);
  addCheck(`access-control:${fn}`, has(re), "Administrative function should be owner protected.");
}

// 4) Initialization checks
addCheck(
  "constructor-token-initialization",
  has(/constructor\(address token\)[\s\S]*require\(token != address\(0\), "token=0"\);[\s\S]*settlementToken = IERC20\(token\);/),
  "Critical immutable token address must be initialized and non-zero."
);
addCheck(
  "reputation-initialization-guard",
  has(/mapping\(address => bool\) private reputationInitialized;/) && has(/if \(!reputationInitialized\[user\]\)/),
  "Distinguish uninitialized reputation from explicit zero score."
);

// 5) Logic/state checks
addCheck(
  "state-transition-guards",
  has(/require\(trade\.status == TradeStatus\.Pending, "bad-status"\);/) &&
    has(/require\(trade\.status == TradeStatus\.Funded, "bad-status"\);/) &&
    has(/require\(trade\.status == TradeStatus\.Disputed, "not-disputed"\);/),
  "Key functions enforce expected status transitions."
);

// Heuristic findings
if (!has(/balanceBefore/) && !has(/balanceAfter/)) {
  report.findings.push({
    id: "LOGIC-001",
    severity: "medium",
    category: "logic",
    title: "Fee-on-transfer / deflationary token incompatibility risk",
    description:
      "fundTrade stores `trade.amount` and calls `safeTransferFrom` once, but does not verify the actual token amount received by the contract. If a fee-on-transfer token is used, contract balance may be lower than `trade.amount`, causing release/refund/resolve transfers to revert later and potentially lock trade flow.",
    evidence: "No pre/post balance delta validation around `safeTransferFrom` in fundTrade.",
    recommendation:
      "Restrict settlement token to non-deflationary tokens, or validate received amount by checking pre/post balances and storing actual escrowed amount."
  });
}

if (has(/if \(totalVotes < minVotesToResolve\)/) && !has(/require\(totalVotes > 0/)) {
  report.findings.push({
    id: "LOGIC-002",
    severity: "low",
    category: "state-management",
    title: "Dispute can resolve with zero votes via fallback branch",
    description:
      "When `totalVotes < minVotesToResolve`, the contract resolves dispute as `Tie` and refunds buyer. With default `minVotesToResolve = 1`, this permits resolution after window even if no arbitrator voted.",
    evidence: "resolveDispute computes `totalVotes` and directly enters fallback branch without explicit non-zero-vote requirement.",
    recommendation:
      "If governance requires minimum participation, add `require(totalVotes > 0, \"no-votes\")` or enforce `minVotesToResolve >= 1` plus explicit quorum semantics and alerting."
  });
}

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(report, null, 2) + "\n");

const failCount = report.findings.length;
console.log(`Static analysis finished. checks=${report.checks.length}, findings=${failCount}`);
for (const f of report.findings) {
  console.log(`- [${f.severity}] ${f.id} ${f.title}`);
}
