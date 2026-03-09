import { EscrowService } from "../services/escrow";
import crypto from "node:crypto";

export type CommandDeps = {
  escrow: EscrowService;
  miniAppBaseUrl: string;
  botUsername?: string;
  deepLinkSecret: string;
};

export function buildMiniAppUrl(deps: CommandDeps, params: {
  dealId: number;
  action?: "open" | "pay" | "release" | "dispute" | "vote";
  extra?: string;
}) {
  const action = params.action || "open";
  const extra = params.extra || "";
  const payload = `deal_${params.dealId}:${action}:${extra}`;
  const signature = crypto.createHmac("sha256", deps.deepLinkSecret).update(payload).digest("hex").slice(0, 16);
  const startApp = `deal_${params.dealId}:${action}${extra ? `:${extra}` : ""}:${signature}`;

  if (deps.botUsername) {
    return `https://t.me/${deps.botUsername}/app?startapp=${startApp}`;
  }
  const search = new URLSearchParams({
    dealId: String(params.dealId),
    action,
    sig: signature
  });
  if (extra) search.set("extra", extra);
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
