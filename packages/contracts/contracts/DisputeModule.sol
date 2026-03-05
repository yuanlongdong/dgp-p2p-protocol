// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrowRuling {
function applyRuling(uint16 sellerBps) external;
function status() external view returns (uint8);
function buyer() external view returns (address);
function seller() external view returns (address);
}

interface IMediatorRegistry {
function isMediator(address) external view returns (bool);
}

interface IKlerosAdapter {
function createDispute(uint256 localDisputeId, address escrow, bytes calldata extraData) external returns (uint256 externalDisputeId);
}

contract DisputeModule {
struct Dispute {
address escrow;
bool resolved;
uint16 sellerBps; // 0~10000
uint16 yesVotes;
uint64 openedAt;
uint256 sumSellerBps;
uint256 externalDisputeId;
bool viaKleros;
mapping(address => bool) voted;
}

IMediatorRegistry public registry;
uint16 public threshold; // 例如 2 票
uint16 public quorum;
uint64 public voteWindow;
uint256 public nextDisputeId;
mapping(uint256 => Dispute) private disputes;
mapping(address => uint256) public activeDisputeByEscrow;
address public owner;
address public klerosAdapter;

event DisputeOpened(uint256 indexed disputeId, address indexed escrow);
event KlerosDisputeOpened(uint256 indexed disputeId, uint256 indexed externalDisputeId, address indexed escrow);
event Voted(uint256 indexed disputeId, address indexed mediator, uint16 sellerBps, uint16 votes);
event Resolved(uint256 indexed disputeId, uint16 sellerBps);
event KlerosAdapterUpdated(address indexed adapter);

constructor(address registry_, uint16 threshold_, uint16 quorum_, uint64 voteWindow_) {
require(registry_ != address(0), "registry=0");
require(threshold_ > 0, "threshold=0");
require(quorum_ > 0, "quorum=0");
require(voteWindow_ > 0, "window=0");

registry = IMediatorRegistry(registry_);
threshold = threshold_;
quorum = quorum_;
voteWindow = voteWindow_;
owner = msg.sender;
}

modifier onlyMediator() {
require(registry.isMediator(msg.sender), "not-mediator");
_;
}

modifier onlyOwner() {
require(msg.sender == owner, "not-owner");
_;
}

modifier onlyKlerosAdapter() {
require(msg.sender == klerosAdapter, "not-kleros-adapter");
_;
}

function setKlerosAdapter(address adapter) external onlyOwner {
klerosAdapter = adapter;
emit KlerosAdapterUpdated(adapter);
}

function openDispute(address escrow) public returns (uint256 disputeId) {
require(escrow != address(0), "escrow=0");
IEscrowRuling e = IEscrowRuling(escrow);
require(msg.sender == e.buyer() || msg.sender == e.seller(), "not-party");
require(e.status() == 4, "escrow-not-disputed");
require(activeDisputeByEscrow[escrow] == 0, "active-dispute");
disputeId = ++nextDisputeId;
disputes[disputeId].escrow = escrow;
disputes[disputeId].openedAt = uint64(block.timestamp);
activeDisputeByEscrow[escrow] = disputeId;
emit DisputeOpened(disputeId, escrow);
}

function openDisputeWithKleros(address escrow, bytes calldata extraData) external returns (uint256 disputeId, uint256 externalDisputeId) {
require(klerosAdapter != address(0), "kleros-not-set");
disputeId = openDispute(escrow);
Dispute storage d = disputes[disputeId];
d.viaKleros = true;
externalDisputeId = IKlerosAdapter(klerosAdapter).createDispute(disputeId, escrow, extraData);
d.externalDisputeId = externalDisputeId;
emit KlerosDisputeOpened(disputeId, externalDisputeId, escrow);
}

function vote(uint256 disputeId, uint16 sellerBps) external onlyMediator {
require(sellerBps <= 10000, "bad-bps");
Dispute storage d = disputes[disputeId];
require(d.escrow != address(0), "no-dispute");
require(!d.resolved, "resolved");
require(!d.viaKleros, "kleros-dispute");
require(!d.voted[msg.sender], "voted");
require(block.timestamp <= d.openedAt + voteWindow, "vote-closed");

d.voted[msg.sender] = true;
d.sumSellerBps += sellerBps;
d.yesVotes += 1;
d.sellerBps = uint16(d.sumSellerBps / d.yesVotes);

emit Voted(disputeId, msg.sender, sellerBps, d.yesVotes);

if (d.yesVotes >= threshold && d.yesVotes >= quorum) {
d.resolved = true;
activeDisputeByEscrow[d.escrow] = 0;
IEscrowRuling(d.escrow).applyRuling(d.sellerBps);
emit Resolved(disputeId, d.sellerBps);
}
}

function resolveAfterWindow(uint256 disputeId) external {
Dispute storage d = disputes[disputeId];
require(d.escrow != address(0), "no-dispute");
require(!d.resolved, "resolved");
require(!d.viaKleros, "kleros-dispute");
require(block.timestamp > d.openedAt + voteWindow, "vote-active");
require(d.yesVotes >= threshold && d.yesVotes >= quorum, "not-enough-votes");

d.resolved = true;
activeDisputeByEscrow[d.escrow] = 0;
IEscrowRuling(d.escrow).applyRuling(d.sellerBps);
emit Resolved(disputeId, d.sellerBps);
}

function applyKlerosRuling(uint256 disputeId, uint16 sellerBps) external onlyKlerosAdapter {
require(sellerBps <= 10000, "bad-bps");
Dispute storage d = disputes[disputeId];
require(d.escrow != address(0), "no-dispute");
require(d.viaKleros, "not-kleros");
require(!d.resolved, "resolved");

d.resolved = true;
d.sellerBps = sellerBps;
activeDisputeByEscrow[d.escrow] = 0;
IEscrowRuling(d.escrow).applyRuling(sellerBps);
emit Resolved(disputeId, sellerBps);
}

function getDispute(uint256 disputeId) external view returns (address escrow, bool resolved, uint16 sellerBps, uint16 votes) {
Dispute storage d = disputes[disputeId];
return (d.escrow, d.resolved, d.sellerBps, d.yesVotes);
}
}
