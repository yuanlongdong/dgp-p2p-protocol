import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";

export function registerDispute(bot: Telegraf, deps: CommandDeps) {
  bot.command("dispute", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply("Usage: /dispute <dealId>");
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply("Deal not found.");
      return;
    }

    deps.escrow.setStatus(deal.id, "DISPUTED");
    const disputeUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "dispute" });
    await ctx.reply(
      `⚠️ Dispute opened\nDeal #${deal.id}\nVoting window: 24h`,
      Markup.inlineKeyboard([
        [Markup.button.url("Open Dispute", disputeUrl)],
        [
          Markup.button.callback("Vote Buyer", `vote:${deal.id}:buyer`),
          Markup.button.callback("Vote Seller", `vote:${deal.id}:seller`)
        ]
      ])
    );
  });

  bot.action(/^vote:(\d+):(buyer|seller)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    const side = ctx.match[2];
    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.answerCbQuery("Deal not found");
      return;
    }
    await ctx.answerCbQuery(`Vote recorded for ${side}`);
    await ctx.reply(
      `Vote submitted for deal #${deal.id} (${side}).\nNext: call vote(disputeId, sellerBps) in MiniApp.`
    );
  });
}
