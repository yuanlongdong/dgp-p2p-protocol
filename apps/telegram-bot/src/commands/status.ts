import { Telegraf } from "telegraf";
import { CommandDeps, formatDealCard } from "./types";

export function registerStatus(bot: Telegraf, deps: CommandDeps) {
  bot.command("status", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);

    if (Number.isInteger(dealId) && dealId > 0) {
      const deal = deps.escrow.getDeal(dealId);
      if (!deal) {
        await ctx.reply("Deal not found.");
        return;
      }
      await ctx.reply(
        formatDealCard({
          id: deal.id,
          buyer: deal.buyerUsername,
          seller: deal.sellerUsername,
          amount: deal.amount,
          token: deal.token,
          status: `${deal.status}${deal.contractEscrowId ? ` | escrowId=${deal.contractEscrowId}` : ""}${deal.disputeId ? ` | disputeId=${deal.disputeId}` : ""}`
        }) + `\nEscrowAddress: ${deal.escrowAddress || "-"}`
      );
      return;
    }

    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply("Usage: /status <dealId>");
      return;
    }
    const deals = deps.escrow.listDealsByUser(username).slice(-5).reverse();
    if (deals.length === 0) {
      await ctx.reply("No deals found.");
      return;
    }
    const body = deals
      .map((deal) => `#${deal.id} ${deal.amount} ${deal.token} ${deal.buyerUsername}->${deal.sellerUsername} ${deal.status}${deal.contractEscrowId ? ` escrowId=${deal.contractEscrowId}` : ""}`)
      .join("\n");
    await ctx.reply(body);
  });
}
