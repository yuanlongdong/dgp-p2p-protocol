import { BigInt } from "@graphprotocol/graph-ts";
import { EscrowCreated } from "../generated/EscrowFactory/EscrowFactory";
import { DisputeOpened, Voted, Resolved } from "../generated/DisputeModule/DisputeModule";
import { Escrow, Dispute, Vote } from "../generated/schema";

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
