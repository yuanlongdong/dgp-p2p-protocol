#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const network = process.argv[2] || "arbSepolia";
const root = process.cwd();
const strict = process.env.HEALTHCHECK_STRICT === "1";

const deploymentPath = path.join(root, "packages", "contracts", "deployments", `${network}.json`);
const preflightPath = path.join(root, "packages", "contracts", "deployments", "production-preflight.json");

const failures = [];
const warnings = [];

if (!existsSync(deploymentPath)) {
  warnings.push(`deployment file missing: ${deploymentPath}`);
}

if (!existsSync(preflightPath)) {
  warnings.push(`preflight file missing: ${preflightPath}`);
} else {
  try {
    const preflight = JSON.parse(readFileSync(preflightPath, "utf8"));
    if (preflight.ok === false) {
      warnings.push("production-preflight.json reports non-ready status");
    }
  } catch (err) {
    failures.push(`invalid preflight json: ${String(err)}`);
  }
}

if (existsSync(deploymentPath)) {
  try {
    const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
    const contracts = deployment.contracts || {};
    for (const key of ["escrowFactory", "disputeModule", "mediatorRegistry"]) {
      if (!contracts[key]) failures.push(`missing contracts.${key} in ${deploymentPath}`);
    }
  } catch (err) {
    failures.push(`invalid deployment json: ${String(err)}`);
  }
}

if (strict && warnings.length > 0) {
  failures.push(...warnings.map((w) => `strict-warning: ${w}`));
}

console.log(`[healthcheck] network=${network} strict=${strict ? "1" : "0"}`);
if (warnings.length > 0) {
  console.log("[healthcheck] warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (failures.length > 0) {
  console.log("[healthcheck] failures:");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}
console.log("[healthcheck] ok");
