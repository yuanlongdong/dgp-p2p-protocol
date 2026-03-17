import { expect } from "chai";
import { ethers } from "hardhat";

describe("OracleRouter", function () {
  it("should read latest price from configured feed", async function () {
    const [owner] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("OracleRouter");
    const router = await Router.deploy(owner.address);
    await router.waitForDeployment();

    const Feed = await ethers.getContractFactory("MockPriceFeed");
    const feed = await Feed.deploy(8, 1_00000000);
    await feed.waitForDeployment();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await router.setFeed(await token.getAddress(), await feed.getAddress());

    const [price, decimals] = await router.latestPrice(await token.getAddress());
    expect(price).to.equal(1_00000000n);
    expect(decimals).to.equal(8);
  });

  it("should revert when feed is missing or price is invalid", async function () {
    const [owner] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("OracleRouter");
    const router = await Router.deploy(owner.address);
    await router.waitForDeployment();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await expect(router.latestPrice(await token.getAddress())).to.be.revertedWith("feed-not-set");

    const Feed = await ethers.getContractFactory("MockPriceFeed");
    const badFeed = await Feed.deploy(8, 0);
    await badFeed.waitForDeployment();
    await router.setFeed(await token.getAddress(), await badFeed.getAddress());
    await expect(router.latestPrice(await token.getAddress())).to.be.revertedWith("bad-price");
  });

  it("should enforce stale-price check when maxAge is configured", async function () {
    const [owner] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("OracleRouter");
    const router = await Router.deploy(owner.address);
    await router.waitForDeployment();

    const Feed = await ethers.getContractFactory("MockPriceFeed");
    const feed = await Feed.deploy(8, 1_00000000);
    await feed.waitForDeployment();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await router.setFeedConfig(await token.getAddress(), await feed.getAddress(), 60);
    await expect(router.latestPrice(await token.getAddress())).to.not.be.reverted;

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);
    await expect(router.latestPrice(await token.getAddress())).to.be.revertedWith("stale-price");

    await feed.setAnswer(1_01000000);
    await expect(router.latestPrice(await token.getAddress())).to.not.be.reverted;
  });
});
