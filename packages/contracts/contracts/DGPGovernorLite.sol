// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20Balance {
function balanceOf(address account) external view returns (uint256);
function totalSupply() external view returns (uint256);
}

interface IProtocolParamsTimelock {
function queueBuyerFeeBps(uint16 value) external;
function applyBuyerFeeBps() external;
function queueMinCollateralBps(uint16 value) external;
function applyMinCollateralBps() external;
}

contract DGPGovernorLite is Ownable {
enum ProposalKind { BuyerFeeBps, MinCollateralBps }
enum ProposalState { Pending, Active, Defeated, Succeeded, Queued, Executed, Canceled }

struct Proposal {
ProposalKind kind;
uint16 value;
uint64 startBlock;
uint64 endBlock;
uint256 forVotes;
uint256 againstVotes;
bool queued;
bool executed;
bool canceled;
string description;
}

IERC20Balance public immutable dgpToken;
IProtocolParamsTimelock public immutable paramsTimelock;

uint64 public votingDelayBlocks;
uint64 public votingPeriodBlocks;
uint256 public proposalThreshold;
uint16 public quorumBps;

uint256 public proposalCount;
mapping(uint256 => Proposal) public proposals;
mapping(uint256 => mapping(address => bool)) public hasVoted;

event ProposalCreated(
uint256 indexed proposalId,
address indexed proposer,
ProposalKind kind,
uint16 value,
uint64 startBlock,
uint64 endBlock,
string description
);
event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
event ProposalQueued(uint256 indexed proposalId);
event ProposalExecuted(uint256 indexed proposalId);
event ProposalCanceled(uint256 indexed proposalId);
event GovernanceConfigUpdated(uint64 votingDelayBlocks, uint64 votingPeriodBlocks, uint256 proposalThreshold, uint16 quorumBps);

constructor(
address initialOwner,
address dgpToken_,
address paramsTimelock_,
uint64 votingDelayBlocks_,
uint64 votingPeriodBlocks_,
uint256 proposalThreshold_,
uint16 quorumBps_
) Ownable(initialOwner) {
require(dgpToken_ != address(0), "token=0");
require(paramsTimelock_ != address(0), "timelock=0");
require(votingPeriodBlocks_ > 0, "period=0");
require(quorumBps_ > 0 && quorumBps_ <= 10000, "bad-quorum");
dgpToken = IERC20Balance(dgpToken_);
paramsTimelock = IProtocolParamsTimelock(paramsTimelock_);
votingDelayBlocks = votingDelayBlocks_;
votingPeriodBlocks = votingPeriodBlocks_;
proposalThreshold = proposalThreshold_;
quorumBps = quorumBps_;
}

function setGovernanceConfig(
uint64 votingDelayBlocks_,
uint64 votingPeriodBlocks_,
uint256 proposalThreshold_,
uint16 quorumBps_
) external onlyOwner {
require(votingPeriodBlocks_ > 0, "period=0");
require(quorumBps_ > 0 && quorumBps_ <= 10000, "bad-quorum");
votingDelayBlocks = votingDelayBlocks_;
votingPeriodBlocks = votingPeriodBlocks_;
proposalThreshold = proposalThreshold_;
quorumBps = quorumBps_;
emit GovernanceConfigUpdated(votingDelayBlocks_, votingPeriodBlocks_, proposalThreshold_, quorumBps_);
}

function propose(ProposalKind kind, uint16 value, string calldata description) external returns (uint256 proposalId) {
require(dgpToken.balanceOf(msg.sender) >= proposalThreshold, "threshold");
if (kind == ProposalKind.BuyerFeeBps) {
require(value <= 10000, "bad-fee");
} else {
require(value >= 10000, "bad-collateral");
}

proposalId = ++proposalCount;
uint64 startBlock = uint64(block.number) + votingDelayBlocks;
uint64 endBlock = startBlock + votingPeriodBlocks;
proposals[proposalId] = Proposal({
kind: kind,
value: value,
startBlock: startBlock,
endBlock: endBlock,
forVotes: 0,
againstVotes: 0,
queued: false,
executed: false,
canceled: false,
description: description
});

emit ProposalCreated(proposalId, msg.sender, kind, value, startBlock, endBlock, description);
}

function castVote(uint256 proposalId, bool support) external {
Proposal storage p = proposals[proposalId];
require(p.startBlock != 0, "proposal-not-found");
require(block.number >= p.startBlock && block.number <= p.endBlock, "vote-closed");
require(!hasVoted[proposalId][msg.sender], "already-voted");

uint256 weight = dgpToken.balanceOf(msg.sender);
require(weight > 0, "no-votes");
hasVoted[proposalId][msg.sender] = true;

if (support) {
p.forVotes += weight;
} else {
p.againstVotes += weight;
}

emit VoteCast(proposalId, msg.sender, support, weight);
}

function queue(uint256 proposalId) external {
Proposal storage p = proposals[proposalId];
require(state(proposalId) == ProposalState.Succeeded, "not-succeeded");

if (p.kind == ProposalKind.BuyerFeeBps) {
paramsTimelock.queueBuyerFeeBps(p.value);
} else {
paramsTimelock.queueMinCollateralBps(p.value);
}

p.queued = true;
emit ProposalQueued(proposalId);
}

function execute(uint256 proposalId) external {
Proposal storage p = proposals[proposalId];
require(state(proposalId) == ProposalState.Queued, "not-queued");

if (p.kind == ProposalKind.BuyerFeeBps) {
paramsTimelock.applyBuyerFeeBps();
} else {
paramsTimelock.applyMinCollateralBps();
}

p.executed = true;
emit ProposalExecuted(proposalId);
}

function cancel(uint256 proposalId) external onlyOwner {
Proposal storage p = proposals[proposalId];
require(p.startBlock != 0, "proposal-not-found");
require(!p.executed, "already-executed");
require(!p.queued, "already-queued");
require(!p.canceled, "already-canceled");
p.canceled = true;
emit ProposalCanceled(proposalId);
}

function state(uint256 proposalId) public view returns (ProposalState) {
Proposal memory p = proposals[proposalId];
require(p.startBlock != 0, "proposal-not-found");

if (p.canceled) return ProposalState.Canceled;
if (p.executed) return ProposalState.Executed;
if (p.queued) return ProposalState.Queued;
if (block.number < p.startBlock) return ProposalState.Pending;
if (block.number <= p.endBlock) return ProposalState.Active;

uint256 quorum = (dgpToken.totalSupply() * quorumBps) / 10000;
if (p.forVotes > p.againstVotes && p.forVotes >= quorum) {
return ProposalState.Succeeded;
}
return ProposalState.Defeated;
}
}
