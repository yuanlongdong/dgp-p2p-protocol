// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IDisputeModuleKleros {
function applyKlerosRuling(uint256 disputeId, uint16 sellerBps) external;
}

interface IArbitrator {
function createDispute(uint256 choices, bytes calldata extraData) external payable returns (uint256 disputeId);
}

contract KlerosAdapter is Ownable {
address public disputeModule;
address public arbitrator;

mapping(uint256 => uint256) public externalToLocalDispute;
mapping(uint256 => address) public externalToEscrow;

event DisputeModuleUpdated(address indexed disputeModule);
event ArbitratorUpdated(address indexed arbitrator);
event ExternalDisputeCreated(uint256 indexed localDisputeId, uint256 indexed externalDisputeId, address indexed escrow);
event RulingForwarded(uint256 indexed externalDisputeId, uint256 indexed localDisputeId, uint16 sellerBps);

constructor(address initialOwner, address disputeModule_, address arbitrator_) Ownable(initialOwner) {
require(disputeModule_ != address(0), "dispute=0");
require(arbitrator_ != address(0), "arbitrator=0");
disputeModule = disputeModule_;
arbitrator = arbitrator_;
}

modifier onlyDisputeModule() {
require(msg.sender == disputeModule, "not-dispute-module");
_;
}

modifier onlyArbitrator() {
require(msg.sender == arbitrator, "not-arbitrator");
_;
}

function setDisputeModule(address disputeModule_) external onlyOwner {
require(disputeModule_ != address(0), "dispute=0");
disputeModule = disputeModule_;
emit DisputeModuleUpdated(disputeModule_);
}

function setArbitrator(address arbitrator_) external onlyOwner {
require(arbitrator_ != address(0), "arbitrator=0");
arbitrator = arbitrator_;
emit ArbitratorUpdated(arbitrator_);
}

function createDispute(
uint256 localDisputeId,
address escrow,
bytes calldata extraData
) external payable onlyDisputeModule returns (uint256 externalDisputeId) {
require(escrow != address(0), "escrow=0");
externalDisputeId = IArbitrator(arbitrator).createDispute{ value: msg.value }(2, extraData);
externalToLocalDispute[externalDisputeId] = localDisputeId;
externalToEscrow[externalDisputeId] = escrow;
emit ExternalDisputeCreated(localDisputeId, externalDisputeId, escrow);
}

function relayRuling(uint256 externalDisputeId, uint16 sellerBps) external onlyArbitrator {
require(sellerBps <= 10000, "bad-bps");
uint256 localDisputeId = externalToLocalDispute[externalDisputeId];
require(localDisputeId != 0, "unknown-dispute");
IDisputeModuleKleros(disputeModule).applyKlerosRuling(localDisputeId, sellerBps);
emit RulingForwarded(externalDisputeId, localDisputeId, sellerBps);
}
}
