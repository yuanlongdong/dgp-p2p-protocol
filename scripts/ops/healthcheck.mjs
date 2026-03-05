import fs from "fs";
import path from "path";

const args = process.argv.slice(2).filter((v) => v !== "--");
const network = args[0] || "arbSepolia";
const rpcUrl = args[1] || process.env.RPC_URL || "";
const subgraphUrl = args[2] || process.env.SUBGRAPH_URL || "";

const root = process.cwd();
const deploymentPath = path.join(root, "packages", "contracts", "deployments", `${network}.json`);

function fail(message) {
  console.error(`[healthcheck] ${message}`);
  process.exit(1);
}

async function checkRpc() {
  if (!rpcUrl) return { ok: false, reason: "rpc url not provided" };
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_blockNumber",
    params: []
  };
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await r.json();
  if (!json?.result) return { ok: false, reason: "bad rpc response" };
  return { ok: true, blockNumberHex: json.result };
}

async function checkSubgraph() {
  if (!subgraphUrl) return { ok: false, reason: "subgraph url not provided" };
  const query = `query Health { escrows(first: 1) { id } disputes(first: 1) { id } }`;
  const r = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query })
  });
  const json = await r.json();
  if (json?.errors) return { ok: false, reason: JSON.stringify(json.errors) };
  return { ok: true };
}

if (!fs.existsSync(deploymentPath)) fail(`deployment file missing: ${deploymentPath}`);
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
for (const key of ["escrowFactory", "disputeModule", "complianceRegistry", "dgpGovernor"]) {
  if (!deployment[key]) fail(`deployment missing key: ${key}`);
}

const rpc = await checkRpc();
const subgraph = await checkSubgraph();

console.log(JSON.stringify({ network, deploymentPath, rpc, subgraph }, null, 2));
if (!rpc.ok && !subgraph.ok) {
  fail("both rpc and subgraph checks failed");
}
