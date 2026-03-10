import { expect } from "chai";
import { ethers } from "hardhat";

describe("Dispute flow (multisig mediators)", function () {
async function setup(params?: { threshold?: number; quorum?: number; voteWindow?: number }) {
const [owner, buyer, seller, m1, m2] = await ethers.getSigners();

const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();
await registry.setMediator(m1.address, true);
await registry.setMediator(m2.address, true);

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(
await registry.getAddress(),
params?.threshold ?? 2,
params?.quorum ?? 2,
params?.voteWindow ?? 3600
);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const amount = ethers.parseUnits("100", 18);
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
await (await dispute.connect(buyer).openDispute(escrowAddr)).wait();

return { buyer, seller, m1, m2, token, escrow, dispute };
}

it("should apply ruling after threshold votes", async function () {
const { buyer, seller, m1, m2, token, dispute } = await setup();

// 70%给卖家
await dispute.connect(m1).vote(1, 7000);
await dispute.connect(m2).vote(1, 7000);

const sellerBal = await token.balanceOf(seller.address);
const buyerBal = await token.balanceOf(buyer.address);
expect(sellerBal).to.equal(ethers.parseUnits("70", 18));
expect(buyerBal).to.equal(ethers.parseUnits("30", 18));
});

it("should reject votes after vote window timeout", async function () {
const { m1, dispute } = await setup({ voteWindow: 1 });

await ethers.provider.send("evm_increaseTime", [2]);
await ethers.provider.send("evm_mine", []);

await expect(dispute.connect(m1).vote(1, 7000)).to.be.revertedWith("vote-closed");
});

it("should not resolve when quorum is not reached", async function () {
const { buyer, seller, m1, token, escrow, dispute } = await setup({ threshold: 1, quorum: 2 });

await dispute.connect(m1).vote(1, 7000);

const [, resolved, , votes] = await dispute.getDispute(1);
expect(resolved).to.equal(false);
expect(votes).to.equal(1);

const status = await escrow.status();
expect(status).to.equal(4);

const sellerBal = await token.balanceOf(seller.address);
const buyerBal = await token.balanceOf(buyer.address);
expect(sellerBal).to.equal(0);
expect(buyerBal).to.equal(0);
});

it("should reject opening dispute for non-disputed escrow", async function () {
const [owner, buyer, seller, m1, m2] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();
await registry.setMediator(m1.address, true);
await registry.setMediator(m2.address, true);

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const now = (await ethers.provider.getBlock("latest"))!.timestamp;
await (await factory.connect(buyer).createEscrow(
seller.address, await token.getAddress(), ethers.parseUnits("10", 18), now + 3600, "ipfs://evidence"
)).wait();
const escrowAddr = await factory.escrows(1n);

await expect(dispute.connect(owner).openDispute(escrowAddr)).to.be.revertedWith("not-party");
await expect(dispute.connect(buyer).openDispute(escrowAddr)).to.be.revertedWith("escrow-not-disputed");
});

it("should enforce resolveAfterWindow guards", async function () {
const { m1, dispute } = await setup({ threshold: 3, quorum: 3, voteWindow: 3 });

await expect(dispute.resolveAfterWindow(1)).to.be.revertedWith("vote-active");
await dispute.connect(m1).vote(1, 6500);

await ethers.provider.send("evm_increaseTime", [4]);
await ethers.provider.send("evm_mine", []);
await expect(dispute.resolveAfterWindow(1)).to.be.revertedWith("not-enough-votes");
});

it("should resolve after vote window when quorum is reached", async function () {
const { buyer, seller, m1, m2, token, dispute } = await setup({ threshold: 2, quorum: 2, voteWindow: 3 });

await dispute.connect(m1).vote(1, 8000);
await dispute.connect(m2).vote(1, 6000);

await ethers.provider.send("evm_increaseTime", [4]);
await ethers.provider.send("evm_mine", []);

await expect(dispute.resolveAfterWindow(1)).to.be.revertedWith("resolved");

const sellerBal = await token.balanceOf(seller.address);
const buyerBal = await token.balanceOf(buyer.address);
expect(sellerBal).to.equal(ethers.parseUnits("70", 18));
expect(buyerBal).to.equal(ethers.parseUnits("30", 18));
});

it("should block mediator votes when registry is paused", async function () {
const [owner, buyer, seller, m1, m2] = await ethers.getSigners();

const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();
const amount = ethers.parseUnits("10", 18);
await token.mint(buyer.address, amount);

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();
await registry.setMediator(m1.address, true);
await registry.setMediator(m2.address, true);

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const now = (await ethers.provider.getBlock("latest"))!.timestamp;
await (await factory.connect(buyer).createEscrow(
seller.address, await token.getAddress(), amount, now + 3600, "ipfs://evidence"
)).wait();
const escrowAddr = await factory.escrows(1n);
const escrow = await ethers.getContractAt("EscrowCore", escrowAddr);

await token.connect(buyer).approve(escrowAddr, amount);
await escrow.connect(buyer).fund();
await escrow.connect(buyer).markDispute("ipfs://dispute");
await dispute.connect(buyer).openDispute(escrowAddr);

await registry.pause();
await expect(dispute.connect(m1).vote(1, 7000)).to.be.revertedWith("not-mediator");
});

it("should prevent opening duplicate active dispute for same escrow", async function () {
const [owner, buyer, seller, m1, m2] = await ethers.getSigners();

const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();
const amount = ethers.parseUnits("10", 18);
await token.mint(buyer.address, amount);

const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();
await registry.setMediator(m1.address, true);
await registry.setMediator(m2.address, true);

const Dispute = await ethers.getContractFactory("DisputeModule");
const dispute = await Dispute.deploy(await registry.getAddress(), 2, 2, 3600);
await dispute.waitForDeployment();

const Factory = await ethers.getContractFactory("EscrowFactory");
const factory = await Factory.deploy(await dispute.getAddress());
await factory.waitForDeployment();

const now = (await ethers.provider.getBlock("latest"))!.timestamp;
await (await factory.connect(buyer).createEscrow(
seller.address, await token.getAddress(), amount, now + 3600, "ipfs://evidence"
)).wait();
const escrowAddr = await factory.escrows(1n);
const escrow = await ethers.getContractAt("EscrowCore", escrowAddr);

await token.connect(buyer).approve(escrowAddr, amount);
await escrow.connect(buyer).fund();
await escrow.connect(buyer).markDispute("ipfs://dispute");

await dispute.connect(buyer).openDispute(escrowAddr);
await expect(dispute.connect(buyer).openDispute(escrowAddr)).to.be.revertedWith("active-dispute");
});

it("should resolve using average sellerBps across votes", async function () {
const { buyer, seller, m1, m2, token, dispute } = await setup({ threshold: 2, quorum: 2, voteWindow: 3600 });
await dispute.connect(m1).vote(1, 7000);
await dispute.connect(m2).vote(1, 5000);

const sellerBal = await token.balanceOf(seller.address);
const buyerBal = await token.balanceOf(buyer.address);
expect(sellerBal).to.equal(ethers.parseUnits("60", 18));
expect(buyerBal).to.equal(ethers.parseUnits("40", 18));
});
});
