import { expect } from "chai";
import { ethers } from "hardhat";

describe("DGPToken", function () {
it("should mint within cap and block overflow", async function () {
const [owner, user] = await ethers.getSigners();
const Token = await ethers.getContractFactory("DGPToken");
const cap = ethers.parseUnits("1000000000", 18);
const token = await Token.deploy(owner.address, cap);
await token.waitForDeployment();

await token.mint(user.address, ethers.parseUnits("100", 18));
expect(await token.balanceOf(user.address)).to.equal(ethers.parseUnits("100", 18));

await expect(token.mint(user.address, cap)).to.be.revertedWith("cap-exceeded");
});
});
