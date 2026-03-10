import { expect } from "chai";
import { ethers } from "hardhat";

describe("OracleTwapGuard", function () {
  it("should mark price safe within max deviation and unsafe beyond threshold", async function () {
    const [owner] = await ethers.getSigners();

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

    expect(await guard.isPriceSafe(await token.getAddress())).to.equal(false);

    await guard.updateTwap(await token.getAddress());
    expect(await guard.isPriceSafe(await token.getAddress())).to.equal(true);

    await feed.setAnswer(1_04000000);
    expect(await guard.isPriceSafe(await token.getAddress())).to.equal(true);

    await feed.setAnswer(1_12000000);
    expect(await guard.isPriceSafe(await token.getAddress())).to.equal(false);
  });

  it("should allow only owner or updater to update twap", async function () {
    const [owner, updater, stranger] = await ethers.getSigners();

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

    await expect(guard.connect(stranger).updateTwap(await token.getAddress())).to.be.revertedWith("not-updater");

    await guard.setUpdater(updater.address, true);
    await guard.connect(updater).updateTwap(await token.getAddress());
    expect(await guard.twapPrice(await token.getAddress())).to.equal(1_00000000n);
  });
});
