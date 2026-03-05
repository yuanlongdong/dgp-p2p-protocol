import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const args = process.argv.slice(2).filter((v) => v !== "--");
const network = args[0] || "arbSepolia";
const subgraphUrl = args[1] || "";
const deployFlag = args.includes("--deploy");
const skipUiBuild = args.includes("--skip-ui-build");

const root = process.cwd();
const deploymentPath = path.join(root, "packages", "contracts", "deployments", `${network}.json`);

function run(cmd, cmdArgs, opts = {}) {
  console.log(`[e2e-demo] $ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...opts
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function fail(message) {
  console.error(`[e2e-demo] ${message}`);
  process.exit(1);
}

if (network !== "arbSepolia" && network !== "opSepolia") {
  fail(`unsupported network: ${network}`);
}

if (deployFlag) {
  const script = network === "arbSepolia" ? "deploy:arb-sepolia" : "deploy:op-sepolia";
  run("pnpm", ["--filter", "@dgp/contracts", script]);
}

if (!fs.existsSync(deploymentPath)) {
  fail(`missing deployment file: ${deploymentPath}`);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
for (const key of ["escrowFactory", "disputeModule", "complianceRegistry", "dgpGovernor"]) {
  if (!deployment[key]) fail(`deployment missing key: ${key}`);
}

if (network === "arbSepolia") {
  run("pnpm", ["subgraph:sync:arb"]);
} else {
  run("pnpm", ["subgraph:sync:op"]);
}
run("pnpm", ["subgraph:build"]);

run("node", ["scripts/ops/prepare-demo-env.mjs", network, subgraphUrl]);

if (!skipUiBuild) {
  run("pnpm", ["--filter", "@dgp/web", "build"]);
  run("pnpm", ["--filter", "@dgp/miniapp", "build"]);
}

console.log("[e2e-demo] done");
console.log(`[e2e-demo] deployment: ${deploymentPath}`);
console.log("[e2e-demo] web env: apps/web/.env.local");
console.log("[e2e-demo] miniapp env: apps/miniapp/.env.local");
if (!subgraphUrl) {
  console.log("[e2e-demo] warning: subgraph url empty, set VITE_SUBGRAPH_URL before history query.");
}
