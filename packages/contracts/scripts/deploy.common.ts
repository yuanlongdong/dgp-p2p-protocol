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

  const KlerosAdapter = await ethers.getContractFactory("KlerosAdapterMock");
  const klerosAdapter = await KlerosAdapter.deploy(await dispute.getAddress());
  await klerosAdapter.waitForDeployment();
  await dispute.setKlerosAdapter(await klerosAdapter.getAddress());

  const Factory = await ethers.getContractFactory("EscrowFactory");
  const factory = await Factory.deploy(await dispute.getAddress());
  await factory.waitForDeployment();

  const Compliance = await ethers.getContractFactory("ComplianceRegistry");
  const compliance = await Compliance.deploy(deployer.address);
  await compliance.waitForDeployment();

  const Vault = await ethers.getContractFactory("GuarantorVault");
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();

  const OracleRouter = await ethers.getContractFactory("OracleRouter");
  const oracleRouter = await OracleRouter.deploy(deployer.address);
  await oracleRouter.waitForDeployment();

  const OracleTwapGuard = await ethers.getContractFactory("OracleTwapGuard");
  const oracleTwapGuard = await OracleTwapGuard.deploy(
    deployer.address,
    await oracleRouter.getAddress(),
    500
  );
  await oracleTwapGuard.waitForDeployment();

  const output = {
    network: network.name,
    chainId: Number(network.config.chainId || 0),
    deployer: deployer.address,
    mediatorRegistry: await registry.getAddress(),
    disputeModule: await dispute.getAddress(),
    klerosAdapter: await klerosAdapter.getAddress(),
    complianceRegistry: await compliance.getAddress(),
    escrowFactory: await factory.getAddress(),
    guarantorVault: await vault.getAddress(),
    oracleRouter: await oracleRouter.getAddress(),
    oracleTwapGuard: await oracleTwapGuard.getAddress(),
    feeRouter: "",
    timestamp: new Date().toISOString()
  };

  await vault.setEscrowFactory(await factory.getAddress());
  await factory.setCollateralConfig(await vault.getAddress(), 15000);
  await factory.setComplianceConfig(await compliance.getAddress(), false);
  await factory.setRiskConfig(await oracleTwapGuard.getAddress(), false);

  const FeeRouter = await ethers.getContractFactory("FeeRouter");
  const feeRouter = await FeeRouter.deploy(deployer.address, deployer.address, 50);
  await feeRouter.waitForDeployment();
  output.feeRouter = await feeRouter.getAddress();

  const outDir = join(process.cwd(), "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${network.name}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log("Deployment file:", outPath);
  console.log("VITE_ESCROW_FACTORY=", output.escrowFactory);
  console.log("VITE_DISPUTE_MODULE=", output.disputeModule);
}
