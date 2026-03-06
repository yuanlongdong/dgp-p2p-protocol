#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const network = process.argv[2] || "arbSepolia";
const health = spawnSync("node", ["scripts/ops/healthcheck.mjs", network], { stdio: "inherit" });

if (health.status !== 0) process.exit(health.status || 1);

console.log([e2e-demo] network=${network});
console.log("[e2e-demo] preflight checks passed.");
console.log("[e2e-demo] next steps:");
console.log("- run: pnpm demo:prepare");
console.log("- start web app and execute demo flow from docs/demo-runbook.md");
