import { expect } from "chai";
import { ethers } from "hardhat";

describe("MediatorRegistry role separation + pause", function () {
it("should allow owner to delegate admin and manage mediators", async function () {
const [owner, admin, mediator] = await ethers.getSigners();
const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();

await registry.setAdmin(admin.address, true);
await registry.connect(admin).setMediator(mediator.address, true);
expect(await registry.isMediator(mediator.address)).to.equal(true);
});

it("should return false for mediators during pause", async function () {
const [owner, mediator] = await ethers.getSigners();
const Registry = await ethers.getContractFactory("MediatorRegistry");
const registry = await Registry.deploy(owner.address);
await registry.waitForDeployment();

await registry.setMediator(mediator.address, true);
expect(await registry.isMediator(mediator.address)).to.equal(true);

await registry.pause();
expect(await registry.isMediator(mediator.address)).to.equal(false);

await registry.unpause();
expect(await registry.isMediator(mediator.address)).to.equal(true);
});
});
