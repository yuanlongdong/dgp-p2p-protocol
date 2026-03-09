import { Markup, Telegraf } from "telegraf";
import { CommandDeps } from "./types";

export function registerRelease(bot: Telegraf, deps: CommandDeps) {
  bot.command("release", async (ctx) => {
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply("Usage: /release <dealId>");
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply("Deal not found.");
      return;
    }

    await ctx.reply(
      `Release escrow for deal #${deal.id}?`,
      Markup.inlineKeyboard([Markup.button.callback("Confirm Release", `release:${deal.id}`)])
    );
  });

  bot.action(/^release:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.answerCbQuery("Deal not found");
      return;
    }
    deps.escrow.setStatus(deal.id, "RELEASE_PENDING");
    const releaseUrl = `${deps.miniAppBaseUrl}?dealId=${deal.id}&action=release`;
    await ctx.editMessageText(
      `Deal #${deal.id}\nPlease sign releaseEscrow() in MiniApp.`,
      Markup.inlineKeyboard([Markup.button.url("Confirm Release On-Chain", releaseUrl)])
    );
    await ctx.answerCbQuery("Release confirmation generated");
  });
}
