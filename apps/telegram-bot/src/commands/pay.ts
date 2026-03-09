import { Markup, Telegraf } from "telegraf";
import { CommandDeps } from "./types";

export function registerPay(bot: Telegraf, deps: CommandDeps) {
  bot.command("pay", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply("Usage: /pay <dealId>");
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply("Deal not found.");
      return;
    }

    const openUrl = `${deps.miniAppBaseUrl}?dealId=${deal.id}&action=pay`;
    await ctx.reply(
      `Deal #${deal.id}\nAmount: ${deal.amount} ${deal.token}\nAction: fundEscrow()`,
      Markup.inlineKeyboard([Markup.button.url("Pay Escrow", openUrl)])
    );

    deps.escrow.setStatus(deal.id, "FUNDED");
    await ctx.reply(`✅ Escrow funded\nDeal #${deal.id} funds locked on-chain`);
  });
}
