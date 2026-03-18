import { expect } from "chai";
import { ethers } from "hardhat";
import { expectCustomError, expectRevertMessage } from "./helpers";

describe("P2PTradeArbitration - attack simulations", function () {
  async function setupWithToken(tokenName: "MockERC20" | "ReentrantMockERC20") {
    const [owner, buyer, seller, arbitrator, attacker] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory(tokenName);
    const token = await Token.deploy("AttackToken", "ATK");
    await token.waitForDeployment();

    const Protocol = await ethers.getContractFactory("P2PTradeArbitration");
    const protocol = await Protocol.deploy(await token.getAddress());
    await protocol.waitForDeployment();

    await protocol.setArbitrator(arbitrator.address, true);

    const amount = ethers.parseUnits("100", 18);
    await token.mint(buyer.address, amount * 200n);

    return {
      owner,
      buyer,
      seller,
      arbitrator,
      attacker,
      token,
      protocol,
      amount,
    };
  }

  async function createAndFund(
    protocol: any,
    token: any,
    buyer: any,
    seller: any,
    amount: bigint,
    deadlineDelta = 3600
  ) {
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    await protocol
      .connect(buyer)
      .createTrade(seller.address, amount, BigInt(now + deadlineDelta));
    await token.connect(buyer).approve(await protocol.getAddress(), amount);
    await protocol.connect(buyer).fundTrade(1);
  }

  it("reentrancy attack simulation: malicious token callback cannot steal extra funds", async function () {
    const { buyer, seller, token, protocol, amount } = await setupWithToken(
      "ReentrantMockERC20"
    );
    await createAndFund(protocol, token, buyer, seller, amount);

    const payload = protocol.interface.encodeFunctionData("releaseTrade", [1]);
    await token.configureHook(await protocol.getAddress(), payload, true);

    await protocol.connect(buyer).releaseTrade(1);

    // Hook attempted a reentrant call, but should fail due nonReentrant/permission constraints.
    expect(await token.lastHookCallSuccess()).to.equal(false);
    expect(await token.balanceOf(seller.address)).to.equal(amount);

    const trade = await protocol.getTrade(1);
    expect(trade.status).to.equal(2n); // Released exactly once
  });

  it("denial-of-service simulation: high-volume sequential operations remain functional", async function () {
    const { buyer, seller, arbitrator, token, protocol, amount } =
      await setupWithToken("MockERC20");
    await protocol.setVoteDuration(5);

    for (let i = 0; i < 30; i++) {
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const tradeId = BigInt(i + 1);
      await protocol
        .connect(buyer)
        .createTrade(seller.address, amount, BigInt(now + 3600));
      await token.connect(buyer).approve(await protocol.getAddress(), amount);
      await protocol.connect(buyer).fundTrade(tradeId);
      await protocol.connect(seller).openDispute(tradeId);
      await protocol.connect(arbitrator).castVote(tradeId, true);
      await ethers.provider.send("evm_increaseTime", [6]);
      await ethers.provider.send("evm_mine", []);
      await protocol.resolveDispute(tradeId);
    }

    expect(await protocol.nextTradeId()).to.equal(30n);
    // Repeated decisive dispute losses should clamp reputation at the minimum band.
    expect(await protocol.getReputation(seller.address)).to.equal(0n);
  });

  it("boundary tests: invalid extremes are rejected", async function () {
    const { owner, buyer, seller, token, protocol, amount } =
      await setupWithToken("MockERC20");
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    await expectRevertMessage(
      protocol
        .connect(buyer)
        .createTrade(seller.address, 0, BigInt(now + 3600)),
      "amount=0"
    );
    await expectRevertMessage(
      protocol.connect(owner).setMinVotesToResolve(0),
      "min-votes=0"
    );

    await protocol
      .connect(buyer)
      .createTrade(seller.address, amount, BigInt(now + 3600));
    await token
      .connect(buyer)
      .approve(await protocol.getAddress(), amount - 1n);
    await expectRevertMessage(protocol.connect(buyer).fundTrade(1), "revert");
  });

  it("malicious call simulation: forged callers cannot execute sensitive paths", async function () {
    const { buyer, seller, attacker, token, protocol, amount } =
      await setupWithToken("MockERC20");
    await createAndFund(protocol, token, buyer, seller, amount);

    await expectCustomError(
      protocol.connect(attacker).setArbitrator(attacker.address, true),
      "OwnableUnauthorizedAccount"
    );
    await expectRevertMessage(
      protocol.connect(attacker).releaseTrade(1),
      "only-buyer"
    );
    await expectRevertMessage(
      protocol.connect(attacker).openDispute(1),
      "not-party"
    );
    await expectRevertMessage(
      protocol.connect(attacker).castVote(1, true),
      "no-dispute"
    );
  });
});
