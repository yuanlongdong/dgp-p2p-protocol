import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";

export function registerRelease(bot: Telegraf, deps: CommandDeps) {
  bot.command("release", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply(t("usage.release"));
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply(t("error.dealNotFound"));
      return;
    }
    const actor = ctx.from?.username;
    if (!actor || actor !== deal.buyerUsername) {
      await ctx.reply(t("error.onlyBuyer", { cmd: "/release" }));
      return;
    }

    await ctx.reply(
      t("release.prompt", { dealId: deal.id }),
      Markup.inlineKeyboard([Markup.button.callback(t("release.confirm"), `release:${deal.id}`)])
    );
    auditLog("releaseRequested", { dealId: deal.id, actor });
  });

  bot.action(/^release:(\d+)$/, async (ctx) => {
    const t = createT();
    const dealId = Number(ctx.match[1]);
    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.answerCbQuery(t("error.dealNotFound"));
      return;
    }
    const actor = ctx.from?.username;
    if (!actor || actor !== deal.buyerUsername) {
      await ctx.answerCbQuery(t("error.onlyBuyerConfirm"));
      return;
    }
    deps.escrow.setStatus(deal.id, "RELEASE_PENDING");
    const releaseUrl = buildMiniAppUrl(deps, { dealId: deal.id, action: "release" });
    await ctx.editMessageText(
      t("release.sign", { dealId: deal.id }),
      Markup.inlineKeyboard([Markup.button.url(t("release.onchain"), releaseUrl)])
    );
    await ctx.answerCbQuery(t("release.cb.generated"));
    auditLog("releaseConfirmGenerated", { dealId: deal.id });
  });
}
