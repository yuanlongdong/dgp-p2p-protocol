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

async function renderPayEntry(
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
        meta: { command: "pay", dealId },
        run: () => ctx.answerCbQuery(t("error.dealNotFound")),
      });
      return;
    }
    await ctx.reply(t("error.dealNotFound"));
    return;
  }

  const actor = ctx.from?.username;
  if (!actor || actor !== deal.buyerUsername) {
    const msg = t("error.onlyBuyer", { cmd: "/pay" });
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "pay", dealId },
        run: () => ctx.answerCbQuery(msg),
      });
      return;
    }
    await ctx.reply(msg);
    return;
  }

  if (!canRunAction(deal.status, "pay")) {
    const text = `${formatDealDetails(deal, t)}\n\n${t("error.actionUnavailable")}\n${t("panel.status")}`;
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "editMessageText",
        meta: { command: "pay", dealId },
        run: () => ctx.editMessageText(text, buildDealActionKeyboard(deal, t)),
      });
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "pay", dealId },
        run: () => ctx.answerCbQuery(t("error.actionUnavailable")),
      });
      return;
    }
    await ctx.reply(text, buildDealActionKeyboard(deal, t));
    return;
  }

  const binding = deal.contractEscrowId
    ? t("pay.binding.bound", { escrowId: deal.contractEscrowId })
    : t("pay.binding.tip");
  const text = `${formatDealDetails(deal, t)}\n\n${t("pay.title", {
    dealId: deal.id,
    amount: deal.amount,
    token: deal.token,
    binding,
  })}`;
  const keyboard = buildMiniAppLaunchKeyboard(deps, deal, t, "pay");

  if (mode === "edit") {
    await withTelegramApiGuard({
      action: "editMessageText",
      meta: { command: "pay", dealId },
      run: () => ctx.editMessageText(text, keyboard),
    });
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "pay", dealId },
      run: () => ctx.answerCbQuery(t("pay.button")),
    });
  } else {
    await ctx.reply(text, keyboard);
  }

  auditLog("payRequested", { dealId: deal.id, actor });
}

export function registerPay(bot: Telegraf, deps: CommandDeps) {
  bot.command("pay", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply(t("usage.pay"));
      return;
    }

    const maybeEscrowId = Number(parts[2]);
    if (Number.isInteger(maybeEscrowId) && maybeEscrowId > 0) {
      deps.escrow.bindEscrowId(dealId, maybeEscrowId);
      auditLog("dealMappingBound", { dealId, escrowId: maybeEscrowId, actor: ctx.from?.username || "unknown" });
    }

    await renderPayEntry(ctx, deps, dealId, "reply");
  });

  bot.action(/^deal:pay:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    await renderPayEntry(ctx, deps, dealId, "edit");
  });
}
