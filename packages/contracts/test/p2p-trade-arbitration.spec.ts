import { expect } from "chai";
import { ethers } from "hardhat";
import { expectRevertMessage } from "./helpers";

describe("P2PTradeArbitration", function () {
  async function deployFixture() {
    const [owner, buyer, seller, arbitrator1, arbitrator2, outsider] =
      await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Contract = await ethers.getContractFactory("P2PTradeArbitration");
    const protocol = await Contract.deploy(await token.getAddress());
    await protocol.waitForDeployment();

    await protocol.setArbitrator(arbitrator1.address, true);
    await protocol.setArbitrator(arbitrator2.address, true);
    await protocol.setVoteDuration(5);
    await protocol.setAppealDuration(5);

    const amount = ethers.parseUnits("100", 18);
    await token.mint(buyer.address, amount * 5000n);
    await token.mint(seller.address, amount * 5000n);

    return {
      owner,
      buyer,
      seller,
      arbitrator1,
      arbitrator2,
      outsider,
      token,
      protocol,
      amount,
    };
  }

  async function createTrade(fx: Awaited<ReturnType<typeof deployFixture>>, amount = fx.amount) {
    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);

    await fx.protocol.connect(fx.buyer).createTrade(fx.seller.address, amount, deadline);
    const tradeId = await fx.protocol.nextTradeId();
    return { tradeId, deadline };
  }

  async function fundTrade(
    fx: Awaited<ReturnType<typeof deployFixture>>,
    tradeId: bigint,
    amount = fx.amount
  ) {
    await fx.token.connect(fx.buyer).approve(await fx.protocol.getAddress(), amount * 1000n);
    await fx.protocol.connect(fx.buyer).fundTrade(tradeId);
  }

  it("creates, funds, locks deposits, and releases escrow while updating reputation", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    const buyerDepositBps = await fx.protocol.getRequiredDepositBps(fx.buyer.address);
    const sellerDepositBps = await fx.protocol.getRequiredDepositBps(fx.seller.address);
    const buyerDeposit = (fx.amount * buyerDepositBps) / 10000n;
    const sellerDeposit = (fx.amount * sellerDepositBps) / 10000n;

    await fx.token.connect(fx.buyer).approve(await fx.protocol.getAddress(), buyerDeposit);
    await fx.token.connect(fx.seller).approve(await fx.protocol.getAddress(), sellerDeposit);
    await fx.protocol.connect(fx.buyer).lockDeposit(tradeId);
    await fx.protocol.connect(fx.seller).lockDeposit(tradeId);

    const sellerBalanceBefore = await fx.token.balanceOf(fx.seller.address);
    await fx.protocol.connect(fx.buyer).releaseEscrow(tradeId);

    expect(await fx.token.balanceOf(fx.seller.address)).to.equal(
      sellerBalanceBefore + fx.amount + sellerDeposit
    );
    expect(await fx.protocol.getReputation(fx.buyer.address)).to.equal(800n);
    expect(await fx.protocol.getReputation(fx.seller.address)).to.equal(800n);

    const trade = await fx.protocol.getTrade(tradeId);
    expect(trade.status).to.equal(2n);
    expect(trade.buyerDepositLocked).to.equal(0n);
    expect(trade.sellerDepositLocked).to.equal(0n);
  });

  it("supports multi-stage disputes and weighted vote(disputeId, sellerBps) resolution", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    await fx.protocol.connect(fx.seller).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);

    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 7000);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId, 5000);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    await fx.protocol.resolveDispute(tradeId);

    expect(await fx.token.balanceOf(fx.seller.address)).to.equal(
      fx.amount * 5000n + ethers.parseUnits("60", 18)
    );
    expect(await fx.token.balanceOf(fx.buyer.address)).to.equal(
      fx.amount * 5000n - fx.amount + ethers.parseUnits("40", 18)
    );

    const dispute = await fx.protocol.getDisputeById(disputeId);
    expect(dispute.stage).to.equal(3n);
    expect(dispute.outcome).to.equal(3n);
    expect(dispute.finalSellerBps).to.equal(6000n);
  });

  it("handles concurrent disputes independently", async function () {
    const fx = await deployFixture();
    const first = await createTrade(fx, ethers.parseUnits("50", 18));
    await fundTrade(fx, first.tradeId, ethers.parseUnits("50", 18));
    const second = await createTrade(fx, ethers.parseUnits("80", 18));
    await fundTrade(fx, second.tradeId, ethers.parseUnits("80", 18));

    await fx.protocol.connect(fx.buyer).openDispute(first.tradeId);
    await fx.protocol.connect(fx.seller).openDispute(second.tradeId);

    const disputeId1 = await fx.protocol.disputeIdByTradeId(first.tradeId);
    const disputeId2 = await fx.protocol.disputeIdByTradeId(second.tradeId);

    await fx.protocol.connect(fx.arbitrator1).vote(disputeId1, 0);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId1, 0);
    await fx.protocol.connect(fx.arbitrator1).vote(disputeId2, 10000);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId2, 10000);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    await fx.protocol.resolveDispute(first.tradeId);
    await fx.protocol.resolveDispute(second.tradeId);

    const firstDispute = await fx.protocol.getDisputeById(disputeId1);
    const secondDispute = await fx.protocol.getDisputeById(disputeId2);
    expect(firstDispute.outcome).to.equal(1n);
    expect(secondDispute.outcome).to.equal(2n);
  });

  it("moves insufficient-vote disputes into appeal and refunds after timeout", async function () {
    const fx = await deployFixture();
    await fx.protocol.setMinVotesToResolve(2);
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    await fx.protocol.connect(fx.buyer).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);
    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 10000);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    await expectRevertMessage(fx.protocol.resolveDispute(tradeId), "appeal-required");
    await fx.protocol.advanceDisputeStage(disputeId);

    const appealDispute = await fx.protocol.getDisputeById(disputeId);
    expect(appealDispute.stage).to.equal(2n);
    expect(appealDispute.round).to.equal(2n);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    await fx.protocol.resolveDispute(tradeId);

    const finalDispute = await fx.protocol.getDisputeById(disputeId);
    expect(finalDispute.outcome).to.equal(4n);
    expect(await fx.token.balanceOf(fx.buyer.address)).to.equal(fx.amount * 5000n);
  });

  it("rejects abnormal arbitration operations", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);
    await fx.protocol.connect(fx.buyer).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);

    await expectRevertMessage(
      fx.protocol.connect(fx.outsider).vote(disputeId, 5000),
      "not-arbitrator"
    );
    await expectRevertMessage(
      fx.protocol.connect(fx.arbitrator1).vote(disputeId, 10001),
      "bad-bps"
    );

    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 0);
    await expectRevertMessage(
      fx.protocol.connect(fx.arbitrator1).vote(disputeId, 10000),
      "already-voted"
    );

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await fx.protocol.advanceDisputeStage(disputeId);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await expectRevertMessage(
      fx.protocol.connect(fx.arbitrator2).vote(disputeId, 5000),
      "appeal-closed"
    );
  });

  it("updates reputation, fees, and trade limits after dispute failure", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    await fx.protocol.connect(fx.seller).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);
    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 0);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId, 0);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await fx.protocol.resolveDispute(tradeId);

    expect(await fx.protocol.getReputation(fx.seller.address)).to.equal(0n);
    expect(await fx.protocol.getRequiredDepositBps(fx.seller.address)).to.equal(2500n);
    expect(await fx.protocol.getFeeBps(fx.seller.address)).to.equal(120n);
    expect(await fx.protocol.getTradeLimit(fx.seller.address)).to.equal(ethers.parseUnits("5000", 18));

    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    await expectRevertMessage(
      fx.protocol
        .connect(fx.buyer)
        .createTrade(fx.seller.address, ethers.parseUnits("6000", 18), deadline),
      "counterparty-limit"
    );
  });

  it("rejects insufficient deposit allowance and concurrent high-risk exposure", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    const buyerDepositBps = await fx.protocol.getRequiredDepositBps(fx.buyer.address);
    const buyerDeposit = (fx.amount * buyerDepositBps) / 10000n;
    await fx.token.connect(fx.buyer).approve(await fx.protocol.getAddress(), buyerDeposit - 1n);
    await expectRevertMessage(
      fx.protocol.connect(fx.buyer).lockDeposit(tradeId),
      "revert"
    );

    await fx.protocol.connect(fx.buyer).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);
    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 0);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId, 0);
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await fx.protocol.resolveDispute(tradeId);

    const latest = await ethers.provider.getBlock("latest");
    const deadline = BigInt((latest?.timestamp ?? 0) + 3600);
    await expectRevertMessage(
      fx.protocol
        .connect(fx.buyer)
        .createTrade(fx.seller.address, ethers.parseUnits("6000", 18), deadline),
      "counterparty-limit"
    );
  });

  it("slashes losing-party deposits after decisive arbitration", async function () {
    const fx = await deployFixture();
    const { tradeId } = await createTrade(fx);
    await fundTrade(fx, tradeId);

    const sellerDepositBps = await fx.protocol.getRequiredDepositBps(fx.seller.address);
    const sellerDeposit = (fx.amount * sellerDepositBps) / 10000n;
    await fx.token.connect(fx.seller).approve(await fx.protocol.getAddress(), sellerDeposit);
    await fx.protocol.connect(fx.seller).lockDeposit(tradeId);

    const buyerBalanceBefore = await fx.token.balanceOf(fx.buyer.address);

    await fx.protocol.connect(fx.seller).openDispute(tradeId);
    const disputeId = await fx.protocol.disputeIdByTradeId(tradeId);
    await fx.protocol.connect(fx.arbitrator1).vote(disputeId, 0);
    await fx.protocol.connect(fx.arbitrator2).vote(disputeId, 0);

    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    await fx.protocol.resolveDispute(tradeId);

    const slashedAmount = sellerDeposit / 2n;
    expect(await fx.token.balanceOf(fx.buyer.address)).to.equal(
      buyerBalanceBefore + fx.amount + slashedAmount
    );

    const trade = await fx.protocol.getTrade(tradeId);
    expect(trade.sellerDepositLocked).to.equal(0n);
  });
});
