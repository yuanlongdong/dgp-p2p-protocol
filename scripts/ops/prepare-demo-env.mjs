#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const network = process.argv[2] || "arbSepolia";
const chainIdByNetwork = { arbSepolia: 421614, opSepolia: 11155420 };

const root = process.cwd();
const deploymentPath = path.join(root, "packages", "contracts", "deployments", ${network}.json);
const envPath = path.join(root, "apps", "web", ".env.demo");

if (!existsSync(deploymentPath)) {
  console.error([prepare-demo-env] deployment file not found: ${deploymentPath});
  process.exit(1);
}

let deployment;
try { deployment = JSON.parse(readFileSync(deploymentPath, "utf8")); }
catch (err) { console.error([prepare-demo-env] invalid deployment json: ${String(err)}); process.exit(1); }

const contracts = deployment.contracts || {};
if (!contracts.escrowFactory || !contracts.disputeModule) {
  console.error("[prepare-demo-env] deployment json missing required contracts fields");
  process.exit(1);
}

const chainId = Number(deployment.chainId || chainIdByNetwork[network] || 0);
if (!Number.isInteger(chainId) || chainId <= 0) {
  console.error("[prepare-demo-env] invalid chainId");
  process.exit(1);
}

mkdirSync(path.dirname(envPath), { recursive: true });
const body = [
  VITE_CHAIN_ID=${chainId},
  "VITE_RPC_URL=",
  VITE_ESCROW_FACTORY=${contracts.escrowFactory},
  VITE_DISPUTE_MODULE=${contracts.disputeModule}
].join("\n");

writeFileSync(envPath, n);
console.log([prepare-demo-env] wrote ${envPath});
