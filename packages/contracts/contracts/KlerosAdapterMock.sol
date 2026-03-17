// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDisputeModuleKlerosCallback {
function applyKlerosRuling(uint256 disputeId, uint16 sellerBps) external;
}

contract KlerosAdapterMock {
address public immutable disputeModule;
uint256 public nextExternalDisputeId;
mapping(uint256 => uint256) public localByExternalId;

event ExternalDisputeCreated(uint256 indexed externalDisputeId, uint256 indexed localDisputeId, address indexed escrow);
event ExternalRulingApplied(uint256 indexed externalDisputeId, uint16 sellerBps);

constructor(address disputeModule_) {
disputeModule = disputeModule_;
}

function createDispute(uint256 localDisputeId, address escrow, bytes calldata) external returns (uint256 externalDisputeId) {
require(msg.sender == disputeModule, "only-module");
externalDisputeId = ++nextExternalDisputeId;
localByExternalId[externalDisputeId] = localDisputeId;
emit ExternalDisputeCreated(externalDisputeId, localDisputeId, escrow);
}

function giveRuling(uint256 externalDisputeId, uint16 sellerBps) external {
uint256 localId = localByExternalId[externalDisputeId];
require(localId != 0, "no-external-dispute");
IDisputeModuleKlerosCallback(disputeModule).applyKlerosRuling(localId, sellerBps);
emit ExternalRulingApplied(externalDisputeId, sellerBps);
}
}
