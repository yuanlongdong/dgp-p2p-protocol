import { Telegraf } from "telegraf";
import {
  buildDealActionKeyboard,
  CommandDeps,
  formatDealDetails,
} from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";

export function registerDeal(bot: Telegraf, deps: CommandDeps) {
  bot.command("deal", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    if (parts.length < 4) {
      await ctx.reply(t("usage.deal"));
      return;
    }

    const seller = parts[1].replace(/^@/, "");
    const amount = parts[2];
    const token = parts[3].toUpperCase();
    const buyer = ctx.from?.username;
    if (!buyer) {
      await ctx.reply(t("error.buyerUsernameRequired"));
      return;
    }

    if (!/^\d+(\.\d+)?$/.test(amount)) {
      await ctx.reply(t("error.invalidAmount"));
      return;
    }

    const deal = deps.escrow.createDeal({
      chatId: ctx.chat.id,
      buyerId: ctx.from.id,
      buyerUsername: buyer,
      sellerUsername: seller,
      amount,
      token,
    });

    auditLog("dealCreated", {
      dealId: deal.id,
      chatId: deal.chatId,
      buyer: deal.buyerUsername,
      seller: deal.sellerUsername,
      amount: deal.amount,
      token: deal.token,
    });

    await ctx.reply(
      `${formatDealDetails(deal, t)}\n\n${t("deal.fundsSecured")}\n${t("panel.dealCreated")}`,
      buildDealActionKeyboard(deal, t)
    );
  });
}
