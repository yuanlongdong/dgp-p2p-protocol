#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "docs/security/mainnet-readiness-signoff.md",
  "docs/security/evidence/deploy-commit-signoff.md",
  "docs/security/preprod-runbook.md",
  ".github/workflows/ci.yml"
];

const contentRules = [
  {
    file: ".github/workflows/ci.yml",
    required: ["pnpm ops:takeover:check", "pnpm security:baseline"]
  },
  {
    file: "docs/security/evidence/deploy-commit-signoff.md",
    required: [
      "- [ ] production-preflight passed",
      "- [ ] contracts test passed on release commit",
      "- [ ] no high/critical audit findings",
      "- [ ] production params register completed",
      "- [ ] no open Critical/High findings"
    ]
  },
  {
    file: "docs/security/preprod-runbook.md",
    required: ["production-preflight.json", "\"ok\": true"]
  }
];

const problems = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    problems.push(`[missing] ${file}`);
  }
}

for (const rule of contentRules) {
  if (!existsSync(rule.file)) continue;
  const body = readFileSync(rule.file, "utf8");
  for (const token of rule.required) {
    if (!body.includes(token)) {
      problems.push(`[missing-content] ${rule.file} missing "${token}"`);
    }
  }
}

if (problems.length > 0) {
  console.error("Security baseline check failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Security baseline check passed.");
