import { EscrowService } from "../services/escrow";

export type CommandDeps = {
  escrow: EscrowService;
  miniAppBaseUrl: string;
};

export function formatDealCard(input: {
  id: number;
  buyer: string;
  seller: string;
  amount: string;
  token: string;
  status: string;
}) {
  return [
    "━━━━━━━━━━ ESCROW DEAL ━━━━━━━━━━",
    `Deal: #${input.id}`,
    `Buyer: @${input.buyer}`,
    `Seller: @${input.seller}`,
    `Amount: ${input.amount} ${input.token}`,
    `Status: ${input.status}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}
