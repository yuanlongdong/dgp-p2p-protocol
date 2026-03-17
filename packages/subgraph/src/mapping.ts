import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { EscrowCreated } from "../generated/EscrowFactory/EscrowFactory";
import { DisputeOpened, Voted, Resolved } from "../generated/DisputeModule/DisputeModule";
import {
  ProposalCreated,
  VoteCast,
  ProposalQueued,
  ProposalExecuted,
  ProposalCanceled
} from "../generated/DGPGovernorLite/DGPGovernorLite";
import {
  KycSet,
  BlacklistSet,
  SanctionSet,
  AmlRiskSet,
  AmlConfigSet
} from "../generated/ComplianceRegistry/ComplianceRegistry";
import {
  Escrow,
  Dispute,
  Vote,
  GovernanceProposal,
  GovernanceVote,
  UserCompliance,
  ComplianceAction
} from "../generated/schema";

function getOrCreateProposal(id: string, now: BigInt, txHash: Bytes): GovernanceProposal {
  let proposal = GovernanceProposal.load(id);
  if (proposal == null) {
    proposal = new GovernanceProposal(id);
    proposal.proposalId = BigInt.fromString(id);
    proposal.proposer = Address.zero();
    proposal.kind = 0;
    proposal.value = 0;
    proposal.description = "";
    proposal.startBlock = BigInt.zero();
    proposal.endBlock = BigInt.zero();
    proposal.forVotes = BigInt.zero();
    proposal.againstVotes = BigInt.zero();
    proposal.queued = false;
    proposal.executed = false;
    proposal.canceled = false;
    proposal.state = 0;
    proposal.createdAt = now;
    proposal.txHash = txHash;
  }
  return proposal as GovernanceProposal;
}

function getOrCreateUserCompliance(account: Address, now: BigInt, txHash: Bytes): UserCompliance {
  const id = account.toHexString();
  let user = UserCompliance.load(id);
  if (user == null) {
    user = new UserCompliance(id);
    user.account = account;
    user.kycApproved = false;
    user.blacklisted = false;
    user.sanctioned = false;
    user.amlRiskBps = 0;
    user.updatedAt = now;
    user.txHash = txHash;
  }
  return user as UserCompliance;
}

function makeAction(eventId: string, action: string, actor: Address, timestamp: BigInt, txHash: Bytes): ComplianceAction {
  const evt = new ComplianceAction(eventId);
  evt.action = action;
  evt.actor = actor;
  evt.timestamp = timestamp;
  evt.txHash = txHash;
  return evt;
}

export function handleEscrowCreated(event: EscrowCreated): void {
  const id = event.params.escrowId.toString();
  const escrow = new Escrow(id);
  escrow.escrowId = event.params.escrowId;
  escrow.buyer = event.params.buyer;
  escrow.seller = event.params.seller;
  escrow.escrow = event.params.escrow;
  escrow.createdAt = event.block.timestamp;
  escrow.save();
}

export function handleDisputeOpened(event: DisputeOpened): void {
  const id = event.params.disputeId.toString();
  const dispute = new Dispute(id);
  dispute.disputeId = event.params.disputeId;
  dispute.escrow = event.params.escrow;
  dispute.resolved = false;
  dispute.sellerBps = 0;
  dispute.votes = 0;
  dispute.openedAt = event.block.timestamp;
  dispute.txHash = event.transaction.hash;
  dispute.save();
}

export function handleVoted(event: Voted): void {
  const id = event.params.disputeId.toString();
  let dispute = Dispute.load(id);
  if (dispute == null) {
    dispute = new Dispute(id);
    dispute.disputeId = event.params.disputeId;
    dispute.escrow = event.address;
    dispute.resolved = false;
    dispute.openedAt = event.block.timestamp;
    dispute.txHash = event.transaction.hash;
  }

  dispute.sellerBps = event.params.sellerBps;
  dispute.votes = event.params.votes;
  dispute.save();

  const vote = new Vote(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  vote.dispute = id;
  vote.mediator = event.params.mediator;
  vote.sellerBps = event.params.sellerBps;
  vote.votes = event.params.votes;
  vote.txHash = event.transaction.hash;
  vote.timestamp = event.block.timestamp;
  vote.save();
}

export function handleResolved(event: Resolved): void {
  const id = event.params.disputeId.toString();
  let dispute = Dispute.load(id);
  if (dispute == null) {
    dispute = new Dispute(id);
    dispute.disputeId = event.params.disputeId;
    dispute.escrow = event.address;
    dispute.openedAt = event.block.timestamp;
    dispute.txHash = event.transaction.hash;
    dispute.votes = 0;
  }
  dispute.resolved = true;
  dispute.sellerBps = event.params.sellerBps;
  dispute.save();
}

export function handleProposalCreated(event: ProposalCreated): void {
  const id = event.params.proposalId.toString();
  const proposal = new GovernanceProposal(id);
  proposal.proposalId = event.params.proposalId;
  proposal.proposer = event.params.proposer;
  proposal.kind = event.params.kind;
  proposal.value = event.params.value;
  proposal.description = event.params.description;
  proposal.startBlock = event.params.startBlock;
  proposal.endBlock = event.params.endBlock;
  proposal.forVotes = BigInt.zero();
  proposal.againstVotes = BigInt.zero();
  proposal.queued = false;
  proposal.executed = false;
  proposal.canceled = false;
  proposal.state = 0;
  proposal.createdAt = event.block.timestamp;
  proposal.txHash = event.transaction.hash;
  proposal.save();
}

export function handleVoteCast(event: VoteCast): void {
  const id = event.params.proposalId.toString();
  const proposal = getOrCreateProposal(id, event.block.timestamp, event.transaction.hash);
  if (event.params.support) {
    proposal.forVotes = proposal.forVotes.plus(event.params.weight);
  } else {
    proposal.againstVotes = proposal.againstVotes.plus(event.params.weight);
  }
  proposal.state = 1;
  proposal.save();

  const vote = new GovernanceVote(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  vote.proposal = id;
  vote.voter = event.params.voter;
  vote.support = event.params.support;
  vote.weight = event.params.weight;
  vote.timestamp = event.block.timestamp;
  vote.txHash = event.transaction.hash;
  vote.save();
}

export function handleProposalQueued(event: ProposalQueued): void {
  const id = event.params.proposalId.toString();
  const proposal = getOrCreateProposal(id, event.block.timestamp, event.transaction.hash);
  proposal.queued = true;
  proposal.state = 4;
  proposal.save();
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  const id = event.params.proposalId.toString();
  const proposal = getOrCreateProposal(id, event.block.timestamp, event.transaction.hash);
  proposal.executed = true;
  proposal.state = 5;
  proposal.save();
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  const id = event.params.proposalId.toString();
  const proposal = getOrCreateProposal(id, event.block.timestamp, event.transaction.hash);
  proposal.canceled = true;
  proposal.state = 6;
  proposal.save();
}

export function handleKycSet(event: KycSet): void {
  const user = getOrCreateUserCompliance(event.params.account, event.block.timestamp, event.transaction.hash);
  user.kycApproved = event.params.approved;
  user.updatedAt = event.block.timestamp;
  user.txHash = event.transaction.hash;
  user.save();

  const evt = makeAction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    "KycSet",
    event.transaction.from,
    event.block.timestamp,
    event.transaction.hash
  );
  evt.account = event.params.account;
  evt.boolValue = event.params.approved;
  evt.save();
}

export function handleBlacklistSet(event: BlacklistSet): void {
  const user = getOrCreateUserCompliance(event.params.account, event.block.timestamp, event.transaction.hash);
  user.blacklisted = event.params.blacklisted;
  user.updatedAt = event.block.timestamp;
  user.txHash = event.transaction.hash;
  user.save();

  const evt = makeAction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    "BlacklistSet",
    event.transaction.from,
    event.block.timestamp,
    event.transaction.hash
  );
  evt.account = event.params.account;
  evt.boolValue = event.params.blacklisted;
  evt.save();
}

export function handleSanctionSet(event: SanctionSet): void {
  const user = getOrCreateUserCompliance(event.params.account, event.block.timestamp, event.transaction.hash);
  user.sanctioned = event.params.sanctioned;
  user.updatedAt = event.block.timestamp;
  user.txHash = event.transaction.hash;
  user.save();

  const evt = makeAction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    "SanctionSet",
    event.transaction.from,
    event.block.timestamp,
    event.transaction.hash
  );
  evt.account = event.params.account;
  evt.boolValue = event.params.sanctioned;
  evt.save();
}

export function handleAmlRiskSet(event: AmlRiskSet): void {
  const user = getOrCreateUserCompliance(event.params.account, event.block.timestamp, event.transaction.hash);
  user.amlRiskBps = event.params.riskBps;
  user.updatedAt = event.block.timestamp;
  user.txHash = event.transaction.hash;
  user.save();

  const evt = makeAction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    "AmlRiskSet",
    event.transaction.from,
    event.block.timestamp,
    event.transaction.hash
  );
  evt.account = event.params.account;
  evt.riskBps = event.params.riskBps;
  evt.save();
}

export function handleAmlConfigSet(event: AmlConfigSet): void {
  const evt = makeAction(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString(),
    "AmlConfigSet",
    event.transaction.from,
    event.block.timestamp,
    event.transaction.hash
  );
  evt.boolValue = event.params.enforce;
  evt.maxRiskBps = event.params.maxRiskBps;
  evt.save();
}
