import { Markup } from "telegraf";
import { EscrowService, type Deal, type DealStatus } from "../services/escrow";
import crypto from "node:crypto";

export type CommandDeps = {
  escrow: EscrowService;
  miniAppBaseUrl: string;
  botUsername?: string;
  deepLinkSecret: string;
};

export type DealAction = "open" | "pay" | "release" | "dispute" | "vote";

const PAYMENT_OVERDUE_MS = 24 * 60 * 60 * 1000;
const VOTE_OVERDUE_MS = 12 * 60 * 60 * 1000;

export function buildMiniAppUrl(
  deps: CommandDeps,
  params: {
    dealId: number;
    action?: DealAction;
    extra?: string;
  }
) {
  const action = params.action || "open";
  const extra = params.extra || "";
  const payload = `deal_${params.dealId}:${action}:${extra}`;
  const signature = crypto
    .createHmac("sha256", deps.deepLinkSecret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  const startApp = `deal_${params.dealId}:${action}${extra ? `:${extra}` : ""}:${signature}`;

  if (deps.botUsername) {
    return `https://t.me/${deps.botUsername}/app?startapp=${startApp}`;
  }
  const search = new URLSearchParams({
    dealId: String(params.dealId),
    action,
    sig: signature,
  });
  if (extra) search.set("extra", extra);
  return `${deps.miniAppBaseUrl}?${search.toString()}`;
}

export function formatDealCard(
  input: {
    id: number;
    buyer: string;
    seller: string;
    amount: string;
    token: string;
    status: string;
  },
  t: (key: string, params?: Record<string, string | number>) => string
) {
  return [
    t("card.title"),
    t("card.deal", { id: input.id }),
    t("card.buyer", { buyer: input.buyer }),
    t("card.seller", { seller: input.seller }),
    t("card.amount", { amount: input.amount, token: input.token }),
    t("card.status", { status: input.status }),
    t("card.footer"),
  ].join("\n");
}

export function getDealReminder(
  deal: Deal,
  t: (key: string, params?: Record<string, string | number>) => string,
  now = Date.now()
) {
  const updatedAt = deal.updatedAt ?? deal.createdAt;
  if (deal.status === "CREATED" && now - updatedAt >= PAYMENT_OVERDUE_MS) {
    return t("reminder.payOverdue", { dealId: deal.id });
  }
  if (deal.status === "DISPUTED" && now - updatedAt >= VOTE_OVERDUE_MS) {
    return t("reminder.voteOverdue", { dealId: deal.id });
  }
  return "";
}

export function formatDealDetails(
  deal: Deal,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const lines = [
    formatDealCard(
      {
        id: deal.id,
        buyer: deal.buyerUsername,
        seller: deal.sellerUsername,
        amount: deal.amount,
        token: deal.token,
        status: deal.status,
      },
      t
    ),
    t("status.escrowAddress", { address: deal.escrowAddress || "-" }),
  ];

  if (deal.contractEscrowId) {
    lines.push(t("status.escrowInline", { escrowId: deal.contractEscrowId }));
  }
  if (deal.disputeId) {
    lines.push(t("status.disputeInline", { disputeId: deal.disputeId }));
  }
  if (deal.buyerReputation !== undefined || deal.sellerReputation !== undefined) {
    lines.push(
      t("status.reputation", {
        buyer: deal.buyerReputation ?? "-",
        seller: deal.sellerReputation ?? "-",
        risk: deal.riskLevel || t("status.riskUnknown"),
      })
    );
  }

  const reminder = getDealReminder(deal, t);
  if (reminder) {
    lines.push(reminder);
  }

  return lines.join("\n");
}

export function canRunAction(status: DealStatus, action: "pay" | "release" | "dispute") {
  if (action === "pay") return status === "CREATED";
  if (action === "release") return status === "FUNDED" || status === "RELEASE_PENDING";
  if (action === "dispute") return status === "FUNDED" || status === "DISPUTED";
  return false;
}

export function buildDealActionKeyboard(
  deal: Deal,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const rows: ReturnType<typeof Markup.inlineKeyboard>["reply_markup"]["inline_keyboard"] = [];
  const statusBtn = Markup.button.callback(t("button.status"), `deal:status:${deal.id}`);

  if (deal.status === "CREATED") {
    rows.push([
      Markup.button.callback(t("button.pay"), `deal:pay:${deal.id}`),
      statusBtn,
    ]);
  } else if (deal.status === "FUNDED") {
    rows.push([
      Markup.button.callback(t("button.release"), `deal:release:${deal.id}`),
      Markup.button.callback(t("button.dispute"), `deal:dispute:${deal.id}`),
    ]);
    rows.push([statusBtn]);
  } else if (deal.status === "DISPUTED") {
    rows.push([
      Markup.button.callback(t("button.dispute"), `deal:dispute:${deal.id}`),
      statusBtn,
    ]);
    rows.push([
      Markup.button.callback(t("dispute.vote.buyer"), `deal:vote:${deal.id}:buyer`),
      Markup.button.callback(t("dispute.vote.seller"), `deal:vote:${deal.id}:seller`),
    ]);
  } else if (deal.status === "RELEASE_PENDING") {
    rows.push([
      Markup.button.callback(t("button.release"), `deal:release:${deal.id}`),
      statusBtn,
    ]);
  } else {
    rows.push([statusBtn]);
  }

  return Markup.inlineKeyboard(rows);
}

export function buildMiniAppLaunchKeyboard(
  deps: CommandDeps,
  deal: Deal,
  t: (key: string, params?: Record<string, string | number>) => string,
  action: DealAction,
  extra?: string
) {
  const url = buildMiniAppUrl(deps, { dealId: deal.id, action, extra });
  return Markup.inlineKeyboard([
    [Markup.button.url(t("button.openMiniApp"), url)],
    [Markup.button.callback(t("button.backStatus"), `deal:status:${deal.id}`)],
  ]);
}
