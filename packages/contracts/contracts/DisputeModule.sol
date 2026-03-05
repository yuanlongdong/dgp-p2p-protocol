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
uint64 openedAt;
mapping(address => bool) voted;
}

IMediatorRegistry public registry;
uint16 public threshold; // 例如 2 票
uint16 public quorum;
uint64 public voteWindow;
uint256 public nextDisputeId;
mapping(uint256 => Dispute) private disputes;

event DisputeOpened(uint256 indexed disputeId, address indexed escrow);
event Voted(uint256 indexed disputeId, address indexed mediator, uint16 sellerBps, uint16 votes);
event Resolved(uint256 indexed disputeId, uint16 sellerBps);

constructor(address registry_, uint16 threshold_, uint16 quorum_, uint64 voteWindow_) {
require(registry_ != address(0), "registry=0");
require(threshold_ > 0, "threshold=0");
require(quorum_ > 0, "quorum=0");
require(voteWindow_ > 0, "window=0");

registry = IMediatorRegistry(registry_);
threshold = threshold_;
quorum = quorum_;
voteWindow = voteWindow_;
}

modifier onlyMediator() {
require(registry.isMediator(msg.sender), "not-mediator");
_;
}

function openDispute(address escrow) external returns (uint256 disputeId) {
require(escrow != address(0), "escrow=0");
disputeId = ++nextDisputeId;
disputes[disputeId].escrow = escrow;
disputes[disputeId].openedAt = uint64(block.timestamp);
emit DisputeOpened(disputeId, escrow);
}

function vote(uint256 disputeId, uint16 sellerBps) external onlyMediator {
require(sellerBps <= 10000, "bad-bps");
Dispute storage d = disputes[disputeId];
require(d.escrow != address(0), "no-dispute");
require(!d.resolved, "resolved");
require(!d.voted[msg.sender], "voted");
require(block.timestamp <= d.openedAt + voteWindow, "vote-closed");

d.voted[msg.sender] = true;
d.sellerBps = sellerBps;
d.yesVotes += 1;

emit Voted(disputeId, msg.sender, sellerBps, d.yesVotes);

if (d.yesVotes >= threshold && d.yesVotes >= quorum) {
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
