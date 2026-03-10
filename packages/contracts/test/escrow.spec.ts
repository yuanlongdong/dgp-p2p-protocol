import { expect } from "chai";
import { ethers } from "hardhat";

describe("EscrowCore lifecycle hardening", function () {
async function deployFixture() {
const [deployer, buyer, seller, other] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const amount = ethers.parseUnits("10", 18);
await token.mint(buyer.address, amount);

const now = (await ethers.provider.getBlock("latest"))!.timestamp;
const Escrow = await ethers.getContractFactory("EscrowCore");
const escrow = await Escrow.deploy(
buyer.address,
seller.address,
await token.getAddress(),
amount,
now + 3600,
"ipfs://evidence",
deployer.address
);
await escrow.waitForDeployment();

return { deployer, buyer, seller, other, token, escrow, amount };
}

it("should revert on invalid constructor params", async function () {
const [deployer, buyer, seller] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();
const now = (await ethers.provider.getBlock("latest"))!.timestamp;
const Escrow = await ethers.getContractFactory("EscrowCore");

await expect(
Escrow.deploy(
buyer.address,
seller.address,
await token.getAddress(),
0,
now + 3600,
"ipfs://evidence",
deployer.address
)
).to.be.revertedWith("amount=0");
});

it("should enforce valid status transitions", async function () {
const { buyer, seller, other, token, escrow, amount } = await deployFixture();

await expect(escrow.connect(buyer).releaseToSeller()).to.be.revertedWith("bad-status");
await expect(escrow.connect(other).fund()).to.be.revertedWith("only-buyer");

await token.connect(buyer).approve(await escrow.getAddress(), amount);
await escrow.connect(buyer).fund();
await expect(escrow.connect(buyer).fund()).to.be.revertedWith("bad-status");

await expect(escrow.connect(other).markDispute("ipfs://x")).to.be.revertedWith("not-party");
await expect(escrow.connect(seller).markDispute("")).to.be.revertedWith("cid-empty");
});

it("should block timeout refund before timeout and allow after timeout", async function () {
const { buyer, token, escrow, amount } = await deployFixture();

await token.connect(buyer).approve(await escrow.getAddress(), amount);
await escrow.connect(buyer).fund();

await expect(escrow.timeoutRefundToBuyer()).to.be.revertedWith("not-timeout");

await ethers.provider.send("evm_increaseTime", [3601]);
await ethers.provider.send("evm_mine", []);
await escrow.timeoutRefundToBuyer();

expect(await escrow.status()).to.equal(3);
});

it("should only allow dispute module to apply ruling", async function () {
const { deployer, buyer, seller, other, token, escrow, amount } = await deployFixture();

await token.connect(buyer).approve(await escrow.getAddress(), amount);
await escrow.connect(buyer).fund();
await escrow.connect(seller).markDispute("ipfs://dispute");

await expect(escrow.connect(other).applyRuling(7000)).to.be.revertedWith("only-dispute-module");
await escrow.connect(deployer).applyRuling(7000);

expect(await escrow.status()).to.equal(5);
});
});
