import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps, formatDealCard } from "./types";
import { auditLog } from "../services/audit-log";

export function registerDeal(bot: Telegraf, deps: CommandDeps) {
  bot.command("deal", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    if (parts.length < 4) {
      await ctx.reply("Usage: /deal @seller amount token");
      return;
    }

    const seller = parts[1].replace(/^@/, "");
    const amount = parts[2];
    const token = parts[3].toUpperCase();
    const buyer = ctx.from?.username;
    if (!buyer) {
      await ctx.reply("Buyer username required. Please set Telegram username.");
      return;
    }

    if (!/^\d+(\.\d+)?$/.test(amount)) {
      await ctx.reply("Invalid amount.");
      return;
    }

    const deal = deps.escrow.createDeal({
      chatId: ctx.chat.id,
      buyerId: ctx.from.id,
      buyerUsername: buyer,
      sellerUsername: seller,
      amount,
      token
    });
    auditLog("dealCreated", {
      dealId: deal.id,
      chatId: deal.chatId,
      buyer: deal.buyerUsername,
      seller: deal.sellerUsername,
      amount: deal.amount,
      token: deal.token
    });

    const openUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "open" });
    await ctx.reply(
      `${formatDealCard({
        id: deal.id,
        buyer,
        seller,
        amount,
        token,
        status: deal.status
      })}\n\nFunds secured by smart contract.\nAdmin cannot access funds.\nOpen secure escrow:`,
      Markup.inlineKeyboard([Markup.button.url("Open Escrow", openUrl)])
    );
  });
}
