import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const chainConfig: Record<string, { chainId: number; defaultRpc: string }> = {
arbSepolia: {
chainId: 421614,
defaultRpc: "https://sepolia-rollup.arbitrum.io/rpc"
},
opSepolia: {
chainId: 11155420,
defaultRpc: "https://sepolia.optimism.io"
}
};

export async function deployAndSave(expectedNetwork?: string) {
const [deployer] = await ethers.getSigners();
const network = await ethers.provider.getNetwork();
const networkName = expectedNetwork ?? process.env.HARDHAT_NETWORK ?? "unknown";
const cfg = chainConfig[networkName];

if (expectedNetwork && networkName !== expectedNetwork) {
throw new Error(`wrong-network: expected=${expectedNetwork} actual=${networkName}`);
}

console.log("Deployer:", deployer.address);
console.log("Network:", networkName, "ChainId:", Number(network.chainId));

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(deployer.address);
await registry.waitForDeployment();

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const out = {
network: networkName,
chainId: Number(network.chainId),
deployer: deployer.address,
contracts: {
mediatorRegistry: await registry.getAddress(),
disputeModule: await dispute.getAddress(),
escrowFactory: await factory.getAddress()
},
deployedAt: new Date().toISOString()
};

const root = path.resolve(__dirname, "../../..");
const depDir = path.join(root, "packages", "contracts", "deployments");
fs.mkdirSync(depDir, { recursive: true });
const deploymentPath = path.join(depDir, `${networkName}.json`);
fs.writeFileSync(deploymentPath, JSON.stringify(out, null, 2) + "\n");

const webEnv = [
`VITE_CHAIN_ID=${cfg?.chainId ?? out.chainId}`,
`VITE_RPC_URL=${process.env.WEB_RPC_URL ?? cfg?.defaultRpc ?? ""}`,
`VITE_ESCROW_FACTORY=${out.contracts.escrowFactory}`,
`VITE_DISPUTE_MODULE=${out.contracts.disputeModule}`
].join("\n");
const webEnvPath = path.join(root, "apps", "web", `.env.${networkName}`);
fs.writeFileSync(webEnvPath, webEnv + "\n");

console.log("Saved deployment:", deploymentPath);
console.log("Saved env template:", webEnvPath);
console.log(out);
}

async function main() {
await deployAndSave();
}

main().catch((e) => {
console.error(e);
process.exit(1);
});
