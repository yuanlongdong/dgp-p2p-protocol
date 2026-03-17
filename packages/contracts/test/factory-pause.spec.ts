import { expect } from "chai";
import { ethers } from "hardhat";

describe("EscrowFactory pause control", function () {
  it("should block createEscrow and createEscrowWithGuarantor when paused", async function () {
    const [owner, buyer, seller, guarantor] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const mediatorRegistry = await Registry.deploy(owner.address);
    await mediatorRegistry.waitForDeployment();

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await mediatorRegistry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();

    const Vault = await ethers.getContractFactory("GuarantorVault");
    const vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();
    await vault.setEscrowFactory(await factory.getAddress());
    await factory.setCollateralConfig(await vault.getAddress(), 15000);

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await token.mint(guarantor.address, ethers.parseUnits("200", 18));
    await token.connect(guarantor).approve(await vault.getAddress(), ethers.parseUnits("200", 18));
    await vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("200", 18));

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await factory.pause();

    await expect(factory.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 3600,
      "ipfs://evidence"
    )).to.be.revertedWith("factory-paused");

    await expect(factory.connect(buyer).createEscrowWithGuarantor(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 3600,
      "ipfs://evidence",
      guarantor.address
    )).to.be.revertedWith("factory-paused");

    await factory.unpause();
    await expect(factory.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 3600,
      "ipfs://evidence"
    )).to.not.be.reverted;
  });
});
