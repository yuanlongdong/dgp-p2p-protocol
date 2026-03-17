import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProtocolParamsTimelock", function () {
it("should enforce 7-day timelock for buyer fee updates", async function () {
const [owner] = await ethers.getSigners();
const Params = await ethers.getContractFactory("ProtocolParamsTimelock");
const params = await Params.deploy(owner.address, 7 * 24 * 3600, 150, 15000);
await params.waitForDeployment();

await params.queueBuyerFeeBps(80);
await expect(params.applyBuyerFeeBps()).to.be.revertedWith("timelock");

await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600 + 1]);
await ethers.provider.send("evm_mine", []);
await params.applyBuyerFeeBps();
expect(await params.buyerFeeBps()).to.equal(80);
});
});
