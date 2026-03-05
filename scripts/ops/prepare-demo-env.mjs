import fs from "fs";
import path from "path";

const args = process.argv.slice(2).filter((v) => v !== "--");
const network = args[0] || "arbSepolia";
const subgraphUrl = args[1] || "";

const root = process.cwd();
const deploymentPath = path.join(root, "packages", "contracts", "deployments", `${network}.json`);
const webEnvPath = path.join(root, "apps", "web", ".env.local");
const miniEnvPath = path.join(root, "apps", "miniapp", ".env.local");

function fail(message) {
  console.error(`[prepare-demo-env] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(deploymentPath)) {
  fail(`deployment not found: ${deploymentPath}`);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
const requiredKeys = [
  "escrowFactory",
  "disputeModule",
  "complianceRegistry",
  "dgpGovernor"
];

for (const key of requiredKeys) {
  if (!deployment[key] || typeof deployment[key] !== "string") {
    fail(`missing required key in deployment json: ${key}`);
  }
}

const webLines = [
  `VITE_ESCROW_FACTORY=${deployment.escrowFactory}`,
  `VITE_DISPUTE_MODULE=${deployment.disputeModule}`,
  `VITE_DGP_GOVERNOR=${deployment.dgpGovernor}`,
  `VITE_SUBGRAPH_URL=${subgraphUrl}`
];

const miniLines = [
  `VITE_ESCROW_FACTORY=${deployment.escrowFactory}`,
  `VITE_DGP_GOVERNOR=${deployment.dgpGovernor}`,
  `VITE_COMPLIANCE_REGISTRY=${deployment.complianceRegistry}`
];

fs.writeFileSync(webEnvPath, `${webLines.join("\n")}\n`);
fs.writeFileSync(miniEnvPath, `${miniLines.join("\n")}\n`);

console.log(`[prepare-demo-env] network=${network}`);
console.log(`[prepare-demo-env] deployment=${deploymentPath}`);
console.log(`[prepare-demo-env] wrote ${webEnvPath}`);
console.log(`[prepare-demo-env] wrote ${miniEnvPath}`);
if (!subgraphUrl) {
  console.log("[prepare-demo-env] VITE_SUBGRAPH_URL is empty, set it before querying history.");
}
