import { expect } from "chai";
import { ethers } from "hardhat";

describe("EscrowFactory risk guard", function () {
  it("should block escrow creation when risk guard says unsafe", async function () {
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

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Feed = await ethers.getContractFactory("MockPriceFeed");
    const feed = await Feed.deploy(8, 1_00000000);
    await feed.waitForDeployment();

    const Router = await ethers.getContractFactory("OracleRouter");
    const router = await Router.deploy(owner.address);
    await router.waitForDeployment();
    await router.setFeed(await token.getAddress(), await feed.getAddress());

    const Guard = await ethers.getContractFactory("OracleTwapGuard");
    const guard = await Guard.deploy(owner.address, await router.getAddress(), 500);
    await guard.waitForDeployment();

    await factory.setRiskConfig(await guard.getAddress(), true);

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await expect(factory.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 3600,
      "ipfs://evidence"
    )).to.be.revertedWith("risk-blocked");

    await guard.updateTwap(await token.getAddress());
    await (await factory.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 3600,
      "ipfs://evidence"
    )).wait();

    await feed.setAnswer(1_15000000);
    await expect(factory.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      ethers.parseUnits("1", 18),
      now + 7200,
      "ipfs://evidence"
    )).to.be.revertedWith("risk-blocked");
  });
});
