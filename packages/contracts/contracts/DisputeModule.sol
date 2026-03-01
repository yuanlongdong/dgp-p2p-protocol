// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowRuling {
function applyRuling(uint16 sellerBps) external;
function status() external view returns (uint8);
}

interface IMediatorRegistry {
function isMediator(address) external view returns (bool);
}

contract DisputeModule {
struct Dispute {
address escrow;
bool resolved;
uint16 sellerBps; // 0~10000
uint16 yesVotes;
mapping(address => bool) voted;
}

IMediatorRegistry public registry;
uint16 public threshold; // 例如 2 票
uint256 public nextDisputeId;
mapping(uint256 => Dispute) private disputes;

event DisputeOpened(uint256 indexed disputeId, address indexed escrow);
event Voted(uint256 indexed disputeId, address indexed mediator, uint16 sellerBps, uint16 votes);
event Resolved(uint256 indexed disputeId, uint16 sellerBps);

constructor(address registry_, uint16 threshold_) {
registry = IMediatorRegistry(registry_);
threshold = threshold_;
}

modifier onlyMediator() {
require(registry.isMediator(msg.sender), "not-mediator");
_;
}

function openDispute(address escrow) external returns (uint256 disputeId) {
disputeId = ++nextDisputeId;
disputes[disputeId].escrow = escrow;
emit DisputeOpened(disputeId, escrow);
}

function vote(uint256 disputeId, uint16 sellerBps) external onlyMediator {
require(sellerBps <= 10000, "bad-bps");
Dispute storage d = disputes[disputeId];
require(d.escrow != address(0), "no-dispute");
require(!d.resolved, "resolved");
require(!d.voted[msg.sender], "voted");

d.voted[msg.sender] = true;
d.sellerBps = sellerBps;
d.yesVotes += 1;

emit Voted(disputeId, msg.sender, sellerBps, d.yesVotes);

if (d.yesVotes >= threshold) {
d.resolved = true;
IEscrowRuling(d.escrow).applyRuling(d.sellerBps);
emit Resolved(disputeId, d.sellerBps);
}
}

function getDispute(uint256 disputeId) external view returns (address escrow, bool resolved, uint16 sellerBps, uint16 votes) {
Dispute storage d = disputes[disputeId];
return (d.escrow, d.resolved, d.sellerBps, d.yesVotes);
}
}
