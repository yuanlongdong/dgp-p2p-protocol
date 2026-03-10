// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IKlerosAdapterRelay {
function relayRuling(uint256 externalDisputeId, uint16 sellerBps) external;
}

contract MockArbitrator {
uint256 public nextDisputeId;
event DisputeCreated(uint256 indexed disputeId, uint256 choices, bytes extraData);

function createDispute(uint256 choices, bytes calldata extraData) external payable returns (uint256 disputeId) {
disputeId = ++nextDisputeId;
emit DisputeCreated(disputeId, choices, extraData);
}

function giveRuling(address adapter, uint256 externalDisputeId, uint16 sellerBps) external {
IKlerosAdapterRelay(adapter).relayRuling(externalDisputeId, sellerBps);
}
}
