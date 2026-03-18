import { expect } from "chai";
import { ethers } from "hardhat";
import { expectRevertMessage } from "./helpers";

describe("EscrowCore lifecycle hardening", function () {
  async function deployEscrow() {
    const [buyer, seller, other, disputeModule] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const amount = ethers.parseUnits("100", 18);
    await token.mint(buyer.address, amount);

    const Escrow = await ethers.getContractFactory("EscrowCore");
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const escrow = await Escrow.deploy(
      buyer.address,
      seller.address,
      await token.getAddress(),
      amount,
      now + 3600,
      "ipfs://evidence",
      disputeModule.address
    );
    await escrow.waitForDeployment();

    return { buyer, seller, other, disputeModule, token, escrow, amount };
  }

  it("should block illegal status transitions", async function () {
    const { buyer, other, escrow, token, amount } = await deployEscrow();
    await token.connect(buyer).approve(await escrow.getAddress(), amount);

    await expectRevertMessage(
      escrow.connect(buyer).releaseToSeller(),
      "bad-status"
    );
    await expectRevertMessage(escrow.connect(other).fund(), "only-buyer");
    await expectRevertMessage(
      escrow.connect(other).markDispute("ipfs://d"),
      "not-party"
    );

    await escrow.connect(buyer).fund();
    await expectRevertMessage(escrow.connect(buyer).fund(), "bad-status");
    await expectRevertMessage(
      escrow.connect(buyer).timeoutRefundToBuyer(),
      "not-timeout"
    );
  });

  it("should enforce timeout refund window", async function () {
    const { buyer, escrow, token, amount } = await deployEscrow();
    await token.connect(buyer).approve(await escrow.getAddress(), amount);
    await escrow.connect(buyer).fund();

    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine", []);

    await escrow.timeoutRefundToBuyer();
    expect(await escrow.status()).to.equal(3n);
    expect(await token.balanceOf(buyer.address)).to.equal(amount);
  });

  it("should enforce dispute-module-only ruling and split funds correctly", async function () {
    const { buyer, seller, other, disputeModule, escrow, token, amount } =
      await deployEscrow();
    await token.connect(buyer).approve(await escrow.getAddress(), amount);
    await escrow.connect(buyer).fund();

    await expectRevertMessage(
      escrow.connect(disputeModule).applyRuling(7000),
      "not-disputed"
    );
    await escrow.connect(buyer).markDispute("ipfs://dispute");

    await expectRevertMessage(
      escrow.connect(other).applyRuling(7000),
      "only-dispute-module"
    );
    await escrow.connect(disputeModule).applyRuling(7000);

    expect(await escrow.status()).to.equal(5n);
    expect(await token.balanceOf(seller.address)).to.equal(
      ethers.parseUnits("70", 18)
    );
    expect(await token.balanceOf(buyer.address)).to.equal(
      ethers.parseUnits("30", 18)
    );
  });
});
