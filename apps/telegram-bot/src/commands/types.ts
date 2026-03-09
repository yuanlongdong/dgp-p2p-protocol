import { EscrowService } from "../services/escrow";

export type CommandDeps = {
  escrow: EscrowService;
  miniAppBaseUrl: string;
  botUsername?: string;
};

export function buildMiniAppUrl(deps: CommandDeps, params: {
  dealId: number;
  action?: "open" | "pay" | "release" | "dispute" | "vote";
  extra?: string;
}) {
  if (deps.botUsername) {
    const suffix = params.action ? `:${params.action}` : "";
    const extra = params.extra ? `:${params.extra}` : "";
    return `https://t.me/${deps.botUsername}/app?startapp=deal_${params.dealId}${suffix}${extra}`;
  }
  const search = new URLSearchParams({
    dealId: String(params.dealId),
    action: params.action || "open"
  });
  if (params.extra) search.set("extra", params.extra);
  return `${deps.miniAppBaseUrl}?${search.toString()}`;
}

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
