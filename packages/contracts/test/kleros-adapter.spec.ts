import { expect } from "chai";
import { ethers } from "hardhat";

describe("Kleros adapter routing", function () {
  async function setup() {
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

    const Adapter = await ethers.getContractFactory("KlerosAdapterMock");
    const adapter = await Adapter.deploy(await dispute.getAddress());
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

    return { buyer, seller, mediator, token, dispute, adapter, escrowAddr };
  }

  it("should open with kleros and block mediator vote", async function () {
    const { buyer, mediator, dispute, adapter, escrowAddr } = await setup();
    await (await dispute.connect(buyer).openDisputeWithKleros(escrowAddr, "0x")).wait();
    const externalId = await adapter.nextExternalDisputeId();
    expect(externalId).to.equal(1n);
    await expect(dispute.connect(mediator).vote(1, 7000)).to.be.revertedWith("kleros-dispute");
  });

  it("should resolve via adapter callback and reject direct callback spoofing", async function () {
    const { buyer, seller, token, dispute, adapter, escrowAddr } = await setup();
    await (await dispute.connect(buyer).openDisputeWithKleros(escrowAddr, "0x1234")).wait();

    await expect(dispute.applyKlerosRuling(1, 7000)).to.be.revertedWith("not-kleros-adapter");

    await adapter.giveRuling(1, 7000);
    expect(await token.balanceOf(seller.address)).to.equal(ethers.parseUnits("70", 18));
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("30", 18));
  });
});
