import { expect } from "chai";
import { ethers } from "hardhat";

describe("P2PTradeArbitration", function () {
  async function deployFixture() {
    const [owner, buyer, seller, arbitrator1, arbitrator2, outsider] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Contract = await ethers.getContractFactory("P2PTradeArbitration");
    const protocol = await Contract.deploy(await token.getAddress());
    await protocol.waitForDeployment();

    await protocol.setArbitrator(arbitrator1.address, true);
    await protocol.setArbitrator(arbitrator2.address, true);

    const amount = ethers.parseUnits("100", 18);
    await token.mint(buyer.address, amount * 200n);

    return { owner, buyer, seller, arbitrator1, arbitrator2, outsider, token, protocol, amount };
  }

  async function createAndFundTrade() {
    const fx = await deployFixture();
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await fx.protocol.connect(fx.buyer).createTrade(fx.seller.address, fx.amount, deadline);
    await fx.token.connect(fx.buyer).approve(await fx.protocol.getAddress(), fx.amount);
    await fx.protocol.connect(fx.buyer).fundTrade(1);

    return { ...fx, deadline };
  }

  it("creates, funds, and releases a trade while updating reputation", async function () {
    const { buyer, seller, token, protocol, amount } = await createAndFundTrade();

    await protocol.connect(buyer).releaseTrade(1);

    expect(await token.balanceOf(seller.address)).to.equal(amount);
    expect(await protocol.getReputation(buyer.address)).to.equal(510);
    expect(await protocol.getReputation(seller.address)).to.equal(510);

    const trade = await protocol.getTrade(1);
    expect(trade.status).to.equal(2); // Released
  });

  it("opens dispute, records votes, and resolves seller win", async function () {
    const { buyer, seller, arbitrator1, arbitrator2, token, protocol, amount } = await createAndFundTrade();

    await protocol.setVoteDuration(1);

    await protocol.connect(seller).openDispute(1);
    await protocol.connect(arbitrator1).castVote(1, false);
    await protocol.connect(arbitrator2).castVote(1, false);

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await protocol.resolveDispute(1);

    expect(await token.balanceOf(seller.address)).to.equal(amount);
    expect(await protocol.getReputation(seller.address)).to.equal(503);
    expect(await protocol.getReputation(buyer.address)).to.equal(492);

    const dispute = await protocol.getDispute(1);
    expect(dispute.outcome).to.equal(2); // SellerWin
  });

  it("resolves tie disputes in favor of refunding buyer", async function () {
    const { buyer, seller, arbitrator1, arbitrator2, token, protocol, amount } = await createAndFundTrade();

    await protocol.setVoteDuration(1);

    await protocol.connect(buyer).openDispute(1);
    await protocol.connect(arbitrator1).castVote(1, true);
    await protocol.connect(arbitrator2).castVote(1, false);

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await protocol.resolveDispute(1);

    expect(await token.balanceOf(buyer.address)).to.equal(amount * 200n);
    expect(await protocol.getReputation(buyer.address)).to.equal(503);
    expect(await protocol.getReputation(seller.address)).to.equal(496);

    const dispute = await protocol.getDispute(1);
    expect(dispute.outcome).to.equal(3); // Tie
  });

  it("prevents duplicate votes from the same arbitrator", async function () {
    const { buyer, arbitrator1, protocol } = await createAndFundTrade();

    await protocol.connect(buyer).openDispute(1);
    await protocol.connect(arbitrator1).castVote(1, true);
    await expect(protocol.connect(arbitrator1).castVote(1, false)).to.be.revertedWith("already-voted");
  });

  it("enforces vote window and disallows early dispute resolution", async function () {
    const { buyer, arbitrator1, protocol } = await createAndFundTrade();

    await protocol.connect(buyer).openDispute(1);
    await protocol.connect(arbitrator1).castVote(1, true);

    await expect(protocol.resolveDispute(1)).to.be.revertedWith("vote-active");
  });

  it("falls back to buyer refund when vote count is below configured minimum", async function () {
    const { buyer, arbitrator1, token, protocol, amount } = await createAndFundTrade();

    await protocol.setVoteDuration(1);

    await protocol.setMinVotesToResolve(2);
    await protocol.connect(buyer).openDispute(1);
    await protocol.connect(arbitrator1).castVote(1, false);

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await protocol.resolveDispute(1);

    expect(await token.balanceOf(buyer.address)).to.equal(amount * 200n);
    const dispute = await protocol.getDispute(1);
    expect(dispute.outcome).to.equal(3); // Tie fallback
  });

  it("rejects non-arbitrator vote and illegal state transitions", async function () {
    const { buyer, outsider, protocol } = await createAndFundTrade();

    await expect(protocol.connect(outsider).releaseTrade(1)).to.be.revertedWith("only-buyer");
    await protocol.connect(buyer).openDispute(1);
    await expect(protocol.connect(outsider).castVote(1, true)).to.be.revertedWith("not-arbitrator");
    await expect(protocol.connect(buyer).releaseTrade(1)).to.be.revertedWith("bad-status");
  });

  it("supports timeout refund path after deadline", async function () {
    const { buyer, seller, token, protocol, amount } = await createAndFundTrade();

    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    await protocol.refundAfterDeadline(1);

    expect(await token.balanceOf(buyer.address)).to.equal(amount * 200n);
    expect(await protocol.getReputation(seller.address)).to.equal(492);
    const trade = await protocol.getTrade(1);
    expect(trade.status).to.equal(3); // Refunded
  });

  it("keeps reputation at 0 once user reaches lower bound", async function () {
    const { buyer, seller, arbitrator1, token, protocol, amount } = await createAndFundTrade();

    await protocol.setMinVotesToResolve(1);

    await protocol.setVoteDuration(1);

    for (let i = 0; i < 55; i++) {
      const latest = await ethers.provider.getBlock("latest");
      const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
      await protocol.connect(buyer).createTrade(seller.address, amount, deadline);
      const tradeId = BigInt(i + 2);
      await token.connect(buyer).approve(await protocol.getAddress(), amount);
      await protocol.connect(buyer).fundTrade(tradeId);
      await protocol.connect(seller).openDispute(tradeId);
      await protocol.connect(arbitrator1).castVote(tradeId, true);
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      await protocol.resolveDispute(tradeId);
    }

    expect(await protocol.getReputation(seller.address)).to.equal(0);
  });
});
