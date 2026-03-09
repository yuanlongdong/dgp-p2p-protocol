import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";
import { auditLog } from "../services/audit-log";

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
    const actor = ctx.from?.username;
    if (!actor || actor !== deal.buyerUsername) {
      await ctx.reply("Only buyer can run /release.");
      return;
    }

    await ctx.reply(
      `Release escrow for deal #${deal.id}?`,
      Markup.inlineKeyboard([Markup.button.callback("Confirm Release", `release:${deal.id}`)])
    );
    auditLog("releaseRequested", { dealId: deal.id, actor });
  });

  bot.action(/^release:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.answerCbQuery("Deal not found");
      return;
    }
    const actor = ctx.from?.username;
    if (!actor || actor !== deal.buyerUsername) {
      await ctx.answerCbQuery("Only buyer can confirm release");
      return;
    }
    deps.escrow.setStatus(deal.id, "RELEASE_PENDING");
    const releaseUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "release" });
    await ctx.editMessageText(
      `Deal #${deal.id}\nPlease sign releaseEscrow() in MiniApp.`,
      Markup.inlineKeyboard([Markup.button.url("Confirm Release On-Chain", releaseUrl)])
    );
    await ctx.answerCbQuery("Release confirmation generated");
    auditLog("releaseConfirmGenerated", { dealId: deal.id });
  });
}
