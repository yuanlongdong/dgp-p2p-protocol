import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
const [deployer] = await ethers.getSigners();
console.log("Deployer:", deployer.address);

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(deployer.address);
await registry.waitForDeployment();

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(await registry.getAddress(), 2);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const out = {
network: "arbitrum-sepolia",
MediatorRegistry: await registry.getAddress(),
DisputeModule: await dispute.getAddress(),
EscrowFactory: await factory.getAddress(),
deployedAt: new Date().toISOString()
};

const root = path.resolve(__dirname, "../../..");
const depDir = path.join(root, "deployments");
fs.mkdirSync(depDir, { recursive: true });
fs.writeFileSync(path.join(depDir, "arb-sepolia.latest.json"), JSON.stringify(out, null, 2));

const webEnv = [
"VITE_CHAIN_ID=421614",
"VITE_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc",
`VITE_ESCROW_FACTORY=${out.EscrowFactory}`,
`VITE_DISPUTE_MODULE=${out.DisputeModule}`
].join("\n");
fs.writeFileSync(path.join(root, "apps/web/.env"), webEnv + "\n");

console.log("Saved:", path.join(depDir, "arb-sepolia.latest.json"));
console.log("Updated: apps/web/.env");
console.log(out);
}

main().catch((e) => {
console.error(e);
process.exit(1);
});
