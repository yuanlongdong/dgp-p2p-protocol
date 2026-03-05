import { expect } from "chai";
import { ethers } from "hardhat";

describe("KlerosAdapter (external arbitrator route)", function () {
  it("should create external dispute and relay ruling into DisputeModule", async function () {
    const [owner, buyer, seller, mediator] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    const token = await Mock.deploy("MockUSDT", "mUSDT");
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("MediatorRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
    await registry.setMediator(mediator.address, true);

    const Dispute = await ethers.getContractFactory("DisputeModule");
    const dispute = await Dispute.deploy(await registry.getAddress(), 1, 1, 3600);
    await dispute.waitForDeployment();

    const Arbitrator = await ethers.getContractFactory("MockArbitrator");
    const arbitrator = await Arbitrator.deploy();
    await arbitrator.waitForDeployment();

    const Adapter = await ethers.getContractFactory("KlerosAdapter");
    const adapter = await Adapter.deploy(owner.address, await dispute.getAddress(), await arbitrator.getAddress());
    await adapter.waitForDeployment();
    await dispute.setKlerosAdapter(await adapter.getAddress());

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

    await (await dispute.connect(buyer).openDisputeWithKleros(escrowAddr, "0x1234")).wait();
    expect(await adapter.externalToLocalDispute(1n)).to.equal(1n);

    await adapter.relayRuling(1n, 7000);
    expect(await token.balanceOf(seller.address)).to.equal(ethers.parseUnits("70", 18));
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("30", 18));
  });
});
