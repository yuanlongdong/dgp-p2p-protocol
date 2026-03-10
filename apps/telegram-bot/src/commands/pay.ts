import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";

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

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply(t("error.dealNotFound"));
      return;
    }
    const actor = ctx.from?.username;
    if (!actor || actor !== deal.buyerUsername) {
      await ctx.reply(t("error.onlyBuyer", { cmd: "/pay" }));
      return;
    }

    const maybeEscrowId = Number(parts[2]);
    if (Number.isInteger(maybeEscrowId) && maybeEscrowId > 0) {
      deps.escrow.bindEscrowId(deal.id, maybeEscrowId);
      auditLog("dealMappingBound", { dealId: deal.id, escrowId: maybeEscrowId, actor });
    }

    const openUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "pay" });
    const binding = deal.contractEscrowId
      ? t("pay.binding.bound", { escrowId: deal.contractEscrowId })
      : t("pay.binding.tip");
    await ctx.reply(
      t("pay.title", { dealId: deal.id, amount: deal.amount, token: deal.token, binding }),
      Markup.inlineKeyboard([Markup.button.url(t("pay.button"), openUrl)])
    );
    auditLog("payRequested", { dealId: deal.id, actor });
  });
}
