import { expect } from "chai";
import { ethers } from "hardhat";

describe("FeeRouter", function () {
it("should route fee and seller amount", async function () {
const [owner, payer, seller, feeRecipient] = await ethers.getSigners();
const Mock = await ethers.getContractFactory("MockERC20");
const token = await Mock.deploy("MockUSDT", "mUSDT");
await token.waitForDeployment();

const Router = await ethers.getContractFactory("FeeRouter");
const router = await Router.deploy(owner.address, feeRecipient.address, 250);
await router.waitForDeployment();

const amount = ethers.parseUnits("100", 18);
await token.mint(payer.address, amount);
await token.connect(payer).approve(await router.getAddress(), amount);

await router.route(await token.getAddress(), payer.address, seller.address, amount);

expect(await token.balanceOf(feeRecipient.address)).to.equal(ethers.parseUnits("2.5", 18));
expect(await token.balanceOf(seller.address)).to.equal(ethers.parseUnits("97.5", 18));
});

it("should restrict fee config to owner", async function () {
const [owner, other, feeRecipient] = await ethers.getSigners();
const Router = await ethers.getContractFactory("FeeRouter");
const router = await Router.deploy(owner.address, feeRecipient.address, 250);
await router.waitForDeployment();

await expect(router.connect(other).setFeeConfig(other.address, 100)).to.be.revertedWithCustomError(
router,
  "OwnableUnauthorizedAccount"
);
await router.setFeeConfig(other.address, 100);
expect(await router.feeBps()).to.equal(100);
});
});
