import { expect } from "chai";
import { ethers } from "hardhat";

describe("Dispute flow (multisig mediators)", function () {
it("should apply ruling after threshold votes", async function () {
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
const dispute = await Dispute.deploy(await registry.getAddress(), 2);
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

const dIdTx = await dispute.openDispute(escrowAddr);
await dIdTx.wait();

// 70%给卖家
await dispute.connect(m1).vote(1, 7000);
await dispute.connect(m2).vote(1, 7000);

const sellerBal = await token.balanceOf(seller.address);
const buyerBal = await token.balanceOf(buyer.address);
expect(sellerBal).to.equal(ethers.parseUnits("70", 18));
expect(buyerBal).to.equal(ethers.parseUnits("30", 18));
});
});
