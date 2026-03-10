import { expect } from "chai";
import { ethers } from "hardhat";

async function mineBlocks(count: number) {
  for (let i = 0; i < count; i += 1) {
    await ethers.provider.send("evm_mine", []);
  }
}

describe("DGPGovernorLite", function () {
  it("should pass proposal, queue in timelock, and execute after delay", async function () {
    const [owner, proposer, voter2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DGPToken");
    const cap = ethers.parseUnits("1000000000", 18);
    const token = await Token.deploy(owner.address, cap);
    await token.waitForDeployment();

    await token.mint(proposer.address, ethers.parseUnits("3000", 18));
    await token.mint(voter2.address, ethers.parseUnits("2000", 18));

    const Params = await ethers.getContractFactory("ProtocolParamsTimelock");
    const timelock = await Params.deploy(owner.address, 3 * 24 * 3600, 150, 15000);
    await timelock.waitForDeployment();

    const Gov = await ethers.getContractFactory("DGPGovernorLite");
    const governor = await Gov.deploy(
      owner.address,
      await token.getAddress(),
      await timelock.getAddress(),
      2,
      5,
      ethers.parseUnits("1000", 18),
      2000
    );
    await governor.waitForDeployment();

    await timelock.transferOwnership(await governor.getAddress());

    await governor.connect(proposer).propose(0, 120, "reduce buyer fee");
    const proposalId = await governor.proposalCount();

    await expect(governor.connect(proposer).castVote(proposalId, true)).to.be.revertedWith("vote-closed");

    await mineBlocks(2);
    await governor.connect(proposer).castVote(proposalId, true);
    await governor.connect(voter2).castVote(proposalId, true);
    await mineBlocks(6);
    expect(await governor.state(proposalId)).to.equal(3); // Succeeded

    await governor.queue(proposalId);
    expect(await governor.state(proposalId)).to.equal(4); // Queued
    await expect(governor.execute(proposalId)).to.be.revertedWith("timelock");

    await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);
    await governor.execute(proposalId);

    expect(await timelock.buyerFeeBps()).to.equal(120);
    expect(await governor.state(proposalId)).to.equal(5); // Executed
  });

  it("should mark proposal defeated when quorum is not reached", async function () {
    const [owner, proposer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DGPToken");
    const cap = ethers.parseUnits("1000000000", 18);
    const token = await Token.deploy(owner.address, cap);
    await token.waitForDeployment();
    await token.mint(proposer.address, ethers.parseUnits("1000", 18));
    await token.mint(owner.address, ethers.parseUnits("9000", 18));

    const Params = await ethers.getContractFactory("ProtocolParamsTimelock");
    const timelock = await Params.deploy(owner.address, 3600, 150, 15000);
    await timelock.waitForDeployment();

    const Gov = await ethers.getContractFactory("DGPGovernorLite");
    const governor = await Gov.deploy(
      owner.address,
      await token.getAddress(),
      await timelock.getAddress(),
      1,
      3,
      ethers.parseUnits("1000", 18),
      8000
    );
    await governor.waitForDeployment();

    await governor.connect(proposer).propose(1, 16000, "raise collateral");
    const proposalId = await governor.proposalCount();
    await mineBlocks(1);
    await governor.connect(proposer).castVote(proposalId, true);
    await mineBlocks(4);

    expect(await governor.state(proposalId)).to.equal(2); // Defeated
    await expect(governor.queue(proposalId)).to.be.revertedWith("not-succeeded");
  });
});
