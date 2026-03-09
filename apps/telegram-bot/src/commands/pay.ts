import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";

export function registerPay(bot: Telegraf, deps: CommandDeps) {
  bot.command("pay", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply("Usage: /pay <dealId> [escrowId]");
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply("Deal not found.");
      return;
    }

    const maybeEscrowId = Number(parts[2]);
    if (Number.isInteger(maybeEscrowId) && maybeEscrowId > 0) {
      deps.escrow.bindEscrowId(deal.id, maybeEscrowId);
    }

    const openUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "pay" });
    await ctx.reply(
      `Deal #${deal.id}\nAmount: ${deal.amount} ${deal.token}\nAction: fundEscrow()\n${deal.contractEscrowId ? `Bound EscrowId: ${deal.contractEscrowId}` : "Tip: use /pay <dealId> <escrowId> to bind mapping."}`,
      Markup.inlineKeyboard([Markup.button.url("Pay Escrow", openUrl)])
    );
  });
}
