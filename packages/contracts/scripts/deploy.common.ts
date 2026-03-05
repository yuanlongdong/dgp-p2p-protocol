import { ethers, network } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export async function deployAll() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const Registry = await ethers.getContractFactory("MediatorRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  const Dispute = await ethers.getContractFactory("DisputeModule");
  const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 86400);
  await dispute.waitForDeployment();

  const Factory = await ethers.getContractFactory("EscrowFactory");
  const factory = await Factory.deploy(await dispute.getAddress());
  await factory.waitForDeployment();

  const Vault = await ethers.getContractFactory("GuarantorVault");
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();

  const FeeRouter = await ethers.getContractFactory("FeeRouter");
  const feeRouter = await FeeRouter.deploy(deployer.address, deployer.address, 50);
  await feeRouter.waitForDeployment();

  const output = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    deployer: deployer.address,
    mediatorRegistry: await registry.getAddress(),
    disputeModule: await dispute.getAddress(),
    escrowFactory: await factory.getAddress(),
    guarantorVault: await vault.getAddress(),
    feeRouter: await feeRouter.getAddress(),
    timestamp: new Date().toISOString()
  };

  const outDir = join(process.cwd(), "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${network.name}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log("Deployment file:", outPath);
  console.log("VITE_ESCROW_FACTORY=", output.escrowFactory);
  console.log("VITE_DISPUTE_MODULE=", output.disputeModule);
}
