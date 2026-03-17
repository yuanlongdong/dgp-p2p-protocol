import { expect } from "chai";
import { ethers } from "hardhat";

describe("GuarantorVault pause control", function () {
  it("should block deposit and withdraw when paused", async function () {
    const [owner, guarantor] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("GuarantorVault");
    const vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    await token.mint(guarantor.address, ethers.parseUnits("10", 18));
    await token.connect(guarantor).approve(await vault.getAddress(), ethers.parseUnits("10", 18));

    await vault.pause();
    await expect(vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("1", 18)))
      .to.be.revertedWithCustomError(vault, "EnforcedPause");

    await vault.unpause();
    await vault.connect(guarantor).deposit(await token.getAddress(), ethers.parseUnits("2", 18));

    await vault.pause();
    await expect(vault.connect(guarantor).withdraw(await token.getAddress(), ethers.parseUnits("1", 18)))
      .to.be.revertedWithCustomError(vault, "EnforcedPause");
  });
});
