import { expect } from "chai";
import { ethers } from "hardhat";

describe("GuarantorVault", function () {
it("should support deposit and withdraw", async function () {
const [owner, guarantor] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Vault = await ethers.getContractFactory("GuarantorVault");
const vault = await Vault.deploy(owner.address);
await vault.waitForDeployment();

const amount = ethers.parseUnits("50", 18);
await token.mint(guarantor.address, amount);
await token.connect(guarantor).approve(await vault.getAddress(), amount);

await vault.connect(guarantor).deposit(await token.getAddress(), amount);
expect(await vault.balances(guarantor.address, await token.getAddress())).to.equal(amount);

await vault.connect(guarantor).withdraw(await token.getAddress(), ethers.parseUnits("20", 18));
expect(await vault.balances(guarantor.address, await token.getAddress())).to.equal(ethers.parseUnits("30", 18));
});

it("should allow slasher to slash guarantor balance", async function () {
const [owner, guarantor, slasher, recipient] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Vault = await ethers.getContractFactory("GuarantorVault");
const vault = await Vault.deploy(owner.address);
await vault.waitForDeployment();

const amount = ethers.parseUnits("40", 18);
await token.mint(guarantor.address, amount);
await token.connect(guarantor).approve(await vault.getAddress(), amount);
await vault.connect(guarantor).deposit(await token.getAddress(), amount);

await vault.setSlasher(slasher.address, true);
await vault.connect(slasher).slash(
guarantor.address,
await token.getAddress(),
ethers.parseUnits("15", 18),
recipient.address
);

expect(await vault.balances(guarantor.address, await token.getAddress())).to.equal(ethers.parseUnits("25", 18));
expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("15", 18));
});
});
