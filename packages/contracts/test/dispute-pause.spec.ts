import { expect } from "chai";
import { ethers } from "hardhat";

describe("DisputeModule pause control", function () {
  it("should block openDispute and vote when paused", async function () {
    const [owner, buyer, seller, mediator] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
    await registry.setMediator(mediator.address, true);

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await registry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = await Factory.deploy(await dispute.getAddress());
    await factory.waitForDeployment();

    const amount = ethers.parseUnits("10", 18);
    await token.mint(buyer.address, amount);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await (await factory.connect(buyer).createEscrow(
      seller.address, await token.getAddress(), amount, now + 3600, "ipfs://evidence"
    )).wait();

    const escrowAddr = await factory.escrows(1n);
    const escrow = await ethers.getContractAt("EscrowCore", escrowAddr);
    await token.connect(buyer).approve(escrowAddr, amount);
    await escrow.connect(buyer).fund();
    await escrow.connect(buyer).markDispute("ipfs://dispute");

    await dispute.pause();
    await expect(dispute.connect(buyer).openDispute(escrowAddr)).to.be.revertedWithCustomError(dispute, "EnforcedPause");

    await dispute.unpause();
    await dispute.connect(buyer).openDispute(escrowAddr);
    await dispute.pause();
    await expect(dispute.connect(mediator).vote(1, 7000)).to.be.revertedWithCustomError(dispute, "EnforcedPause");
  });
});
