import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProtocolTreasury", function () {
it("should distribute fees by configured split", async function () {
const [owner, payer, guarantor, mediator, insurance, treasury, buyback] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Treasury = await ethers.getContractFactory("ProtocolTreasury");
const treasuryContract = await Treasury.deploy(
owner.address,
guarantor.address,
mediator.address,
insurance.address,
treasury.address,
buyback.address
);
await treasuryContract.waitForDeployment();

const amount = ethers.parseUnits("100", 18);
await token.mint(payer.address, amount);
await token.connect(payer).approve(await treasuryContract.getAddress(), amount);
await treasuryContract.connect(payer).distribute(await token.getAddress(), amount);

expect(await token.balanceOf(guarantor.address)).to.equal(ethers.parseUnits("55", 18));
expect(await token.balanceOf(mediator.address)).to.equal(ethers.parseUnits("15", 18));
expect(await token.balanceOf(insurance.address)).to.equal(ethers.parseUnits("15", 18));
expect(await token.balanceOf(treasury.address)).to.equal(ethers.parseUnits("10", 18));
expect(await token.balanceOf(buyback.address)).to.equal(ethers.parseUnits("5", 18));
});
});
