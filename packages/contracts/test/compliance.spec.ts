import { expect } from "chai";
import { ethers } from "hardhat";

describe("Compliance registry and factory enforcement", function () {
  it("should enforce KYC and blacklist rules when enabled", async function () {
    const [owner, buyer, seller] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const mediatorRegistry = await Registry.deploy(owner.address);
    await mediatorRegistry.waitForDeployment();

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await mediatorRegistry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();

    const Compliance = await ethers.getContractFactory("ComplianceRegistry");
    const compliance = await Compliance.deploy(owner.address);
    await compliance.waitForDeployment();
    await factory.setComplianceConfig(await compliance.getAddress(), true);

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    await expect(factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 3600, "ipfs://evidence"
    )).to.be.revertedWith("compliance-blocked");

    await compliance.setKyc(buyer.address, true);
    await compliance.setKyc(seller.address, true);

    await (await factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 3600, "ipfs://evidence"
    )).wait();

    await compliance.setBlacklist(seller.address, true);
    await expect(factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 7200, "ipfs://evidence"
    )).to.be.revertedWith("compliance-blocked");
  });

  it("should enforce guarantor compliance in createEscrowWithGuarantor", async function () {
    const [owner, buyer, seller, guarantor] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const mediatorRegistry = await Registry.deploy(owner.address);
    await mediatorRegistry.waitForDeployment();
    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await mediatorRegistry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Vault = await ethers.getContractFactory("GuarantorVault");
    const vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();
    await vault.setEscrowFactory(await factory.getAddress());
    await factory.setCollateralConfig(await vault.getAddress(), 15000);

    const Compliance = await ethers.getContractFactory("ComplianceRegistry");
    const compliance = await Compliance.deploy(owner.address);
    await compliance.waitForDeployment();
    await factory.setComplianceConfig(await compliance.getAddress(), true);

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await compliance.setKyc(buyer.address, true);
    await compliance.setKyc(seller.address, true);

    await token.mint(guarantor.address, ethers.parseUnits("200", 18));
    await token.connect(guarantor).approve(await vault.getAddress(), ethers.parseUnits("200", 18));
    await vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("200", 18));

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await expect(factory.connect(buyer).createEscrowWithGuarantor(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("100", 18),
      now + 3600,
      "ipfs://evidence",
      guarantor.address
    )).to.be.revertedWith("compliance-blocked");

    await compliance.setKyc(guarantor.address, true);
    await (await factory.connect(buyer).createEscrowWithGuarantor(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("100", 18),
      now + 3600,
      "ipfs://evidence",
      guarantor.address
    )).wait();
  });

  it("should enforce AML sanctions and risk score only when AML is enabled", async function () {
    const [owner, buyer, seller] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const mediatorRegistry = await Registry.deploy(owner.address);
    await mediatorRegistry.waitForDeployment();

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await mediatorRegistry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();

    const Compliance = await ethers.getContractFactory("ComplianceRegistry");
    const compliance = await Compliance.deploy(owner.address);
    await compliance.waitForDeployment();
    await factory.setComplianceConfig(await compliance.getAddress(), true);

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await compliance.setKyc(buyer.address, true);
    await compliance.setKyc(seller.address, true);
    await compliance.setAmlRiskScore(seller.address, 9500);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await (await factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 3600, "ipfs://evidence"
    )).wait();

    await compliance.setAmlConfig(true, 7000);
    await expect(factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 7200, "ipfs://evidence"
    )).to.be.revertedWith("compliance-blocked");

    await compliance.setAmlRiskScore(seller.address, 3000);
    await compliance.setSanction(seller.address, true);
    await expect(factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), ethers.parseUnits("1", 18), now + 10800, "ipfs://evidence"
    )).to.be.revertedWith("compliance-blocked");
  });
});
