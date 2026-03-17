import { expect } from "chai";
import { ethers } from "hardhat";

describe("Collateral flow (>=150%)", function () {
  it("should lock 150% collateral on createEscrowWithGuarantor and unlock after completion", async function () {
    const [owner, buyer, seller, guarantor] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
    await dispute.waitForDeployment();

    const Vault = await ethers.getContractFactory("GuarantorVault");
    const vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();

    await vault.setEscrowFactory(await factory.getAddress());
    await factory.setCollateralConfig(await vault.getAddress(), 15000);

    const escrowAmount = ethers.parseUnits("100", 18);
    await token.mint(guarantor.address, ethers.parseUnits("200", 18));
    await token.connect(guarantor).approve(await vault.getAddress(), ethers.parseUnits("200", 18));
    await vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("200", 18));

    await token.mint(buyer.address, escrowAmount);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await (await factory.connect(buyer).createEscrowWithGuarantor(
      seller.address,
      await token.getAddress(),
      escrowAmount,
      now + 3600,
      "ipfs://evidence",
      guarantor.address
    )).wait();

    const escrowAddr = await factory.escrows(1n);
    expect(await vault.lockedBalances(guarantor.address, await token.getAddress())).to.equal(ethers.parseUnits("150", 18));
    expect(await vault.hasActivePosition(escrowAddr)).to.equal(true);

    await token.connect(buyer).approve(escrowAddr, escrowAmount);
    const escrow = await ethers.getContractAt("EscrowCore", escrowAddr);
    await escrow.connect(buyer).fund();
    await escrow.connect(buyer).releaseToSeller();
    await factory.releaseGuarantorCollateral(1n);

    expect(await vault.lockedBalances(guarantor.address, await token.getAddress())).to.equal(0);
    expect(await vault.hasActivePosition(escrowAddr)).to.equal(false);
  });

  it("should reject creation when guarantor collateral is insufficient", async function () {
    const [owner, buyer, seller, guarantor] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
    await dispute.waitForDeployment();

    const Vault = await ethers.getContractFactory("GuarantorVault");
    const vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();
    await vault.setEscrowFactory(await factory.getAddress());
    await factory.setCollateralConfig(await vault.getAddress(), 15000);

    await token.mint(guarantor.address, ethers.parseUnits("20", 18));
    await token.connect(guarantor).approve(await vault.getAddress(), ethers.parseUnits("20", 18));
    await vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("20", 18));

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await expect(factory.connect(buyer).createEscrowWithGuarantor(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("100", 18),
      now + 3600,
      "ipfs://evidence",
      guarantor.address
    )).to.be.revertedWith("insufficient-collateral");
  });
});
