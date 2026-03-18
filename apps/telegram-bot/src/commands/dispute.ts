import { Telegraf } from "telegraf";
import {
  buildDealActionKeyboard,
  buildMiniAppLaunchKeyboard,
  canRunAction,
  CommandDeps,
  formatDealDetails,
} from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";
import { withTelegramApiGuard } from "../services/telegram-safe";

async function renderDisputeEntry(
  ctx: any,
  deps: CommandDeps,
  dealId: number,
  mode: "reply" | "edit"
) {
  const t = createT();
  const deal = deps.escrow.getDeal(dealId);
  if (!deal) {
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "dispute", dealId },
        run: () => ctx.answerCbQuery(t("error.dealNotFound")),
      });
      return;
    }
    await ctx.reply(t("error.dealNotFound"));
    return;
  }

  const actor = ctx.from?.username;
  if (!actor || (actor !== deal.buyerUsername && actor !== deal.sellerUsername)) {
    const msg = t("error.onlyBuyerOrSeller");
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "dispute", dealId },
        run: () => ctx.answerCbQuery(msg),
      });
      return;
    }
    await ctx.reply(msg);
    return;
  }

  if (!canRunAction(deal.status, "dispute")) {
    const text = `${formatDealDetails(deal, t)}\n\n${t("error.actionUnavailable")}\n${t("panel.status")}`;
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "editMessageText",
        meta: { command: "dispute", dealId },
        run: () => ctx.editMessageText(text, buildDealActionKeyboard(deal, t)),
      });
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "dispute", dealId },
        run: () => ctx.answerCbQuery(t("error.actionUnavailable")),
      });
      return;
    }
    await ctx.reply(text, buildDealActionKeyboard(deal, t));
    return;
  }

  if (deal.status !== "DISPUTED") {
    deps.escrow.setStatus(deal.id, "DISPUTED");
  }
  const latestDeal = deps.escrow.getDeal(deal.id)!;
  const extra = latestDeal.disputeId ? String(latestDeal.disputeId) : undefined;
  const text = `${formatDealDetails(latestDeal, t)}\n\n${t("dispute.opened", { dealId: latestDeal.id })}`;
  const keyboard = buildMiniAppLaunchKeyboard(deps, latestDeal, t, "dispute", extra);

  if (mode === "edit") {
    await withTelegramApiGuard({
      action: "editMessageText",
      meta: { command: "dispute", dealId },
      run: () => ctx.editMessageText(text, keyboard),
    });
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "dispute", dealId },
      run: () => ctx.answerCbQuery(t("dispute.button.open")),
    });
  } else {
    await ctx.reply(text, keyboard);
  }

  auditLog("disputeOpened", { dealId: latestDeal.id, actor });
}

async function renderVoteEntry(
  ctx: any,
  deps: CommandDeps,
  dealId: number,
  side: "buyer" | "seller"
) {
  const t = createT();
  const deal = deps.escrow.getDeal(dealId);
  if (!deal) {
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "vote", dealId },
      run: () => ctx.answerCbQuery(t("error.dealNotFound")),
    });
    return;
  }

  if (deal.status !== "DISPUTED") {
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "vote", dealId },
      run: () => ctx.answerCbQuery(t("error.actionUnavailable")),
    });
    return;
  }

  const sideLabel = side === "buyer" ? t("side.buyer") : t("side.seller");
  const extra = deal.disputeId ? `${deal.disputeId}:${side}` : side;
  const text = `${formatDealDetails(deal, t)}\n\n${t("dispute.vote.submitted", {
    dealId: deal.id,
    side: sideLabel,
  })}`;
  const keyboard = buildMiniAppLaunchKeyboard(deps, deal, t, "vote", extra);

  await withTelegramApiGuard({
    action: "editMessageText",
    meta: { command: "vote", dealId },
    run: () => ctx.editMessageText(text, keyboard),
  });
  await withTelegramApiGuard({
    action: "answerCbQuery",
    meta: { command: "vote", dealId },
    run: () => ctx.answerCbQuery(t("dispute.vote.recorded", { side: sideLabel })),
  });

  auditLog("voteIntent", {
    dealId: deal.id,
    disputeId: deal.disputeId,
    side,
    actor: ctx.from?.username || "unknown",
  });
}

export function registerDispute(bot: Telegraf, deps: CommandDeps) {
  bot.command("dispute", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply(t("usage.dispute"));
      return;
    }

    await renderDisputeEntry(ctx, deps, dealId, "reply");
  });

  bot.action(/^deal:dispute:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    await renderDisputeEntry(ctx, deps, dealId, "edit");
  });

  bot.action(/^deal:vote:(\d+):(buyer|seller)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    const side = ctx.match[2] as "buyer" | "seller";
    await renderVoteEntry(ctx, deps, dealId, side);
  });
}
