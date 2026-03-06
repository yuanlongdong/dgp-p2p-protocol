#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const network = process.argv[2] || "arbSepolia";
const root = process.cwd();
const deploymentPath = path.join(root, "packages", "contracts", "deployments", ${network}.json);
const preflightPath = path.join(root, "packages", "contracts", "deployments", "production-preflight.json");

const failures = [];
const warnings = [];

if (!existsSync(deploymentPath)) warnings.push(deployment file missing: ${deploymentPath});
if (!existsSync(preflightPath)) {
  warnings.push(preflight file missing: ${preflightPath});
} else {
  try {
    const preflight = JSON.parse(readFileSync(preflightPath, "utf8"));
    if (preflight.ok === false) warnings.push("production-preflight.json reports non-ready status");
  } catch (err) {
    failures.push(invalid preflight json: ${String(err)});
  }
}

if (existsSync(deploymentPath)) {
  try {
    const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
    const contracts = deployment.contracts || {};
    for (const key of ["escrowFactory", "disputeModule", "mediatorRegistry"]) {
      if (!contracts[key]) failures.push(missing contracts.${key} in ${deploymentPath});
    }
  } catch (err) {
    failures.push(invalid deployment json: ${String(err)});
  }
}

console.log([healthcheck] network=${network});
if (warnings.length) {
  console.log("[healthcheck] warnings:");
  for (const w of warnings) console.log(- ${w});
}
if (failures.length) {
  console.log("[healthcheck] failures:");
  for (const f of failures) console.log(- ${f});
  process.exit(1);
}
console.log("[healthcheck] ok");
