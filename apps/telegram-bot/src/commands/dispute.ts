import { Markup, Telegraf } from "telegraf";
import { buildMiniAppUrl, CommandDeps } from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";
import { withTelegramApiGuard } from "../services/telegram-safe";

export function registerDispute(bot: Telegraf, deps: CommandDeps) {
  bot.command("dispute", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);
    if (!Number.isInteger(dealId) || dealId <= 0) {
      await ctx.reply(t("usage.dispute"));
      return;
    }

    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await ctx.reply(t("error.dealNotFound"));
      return;
    }
    const actor = ctx.from?.username;
    if (
      !actor ||
      (actor !== deal.buyerUsername && actor !== deal.sellerUsername)
    ) {
      await ctx.reply(t("error.onlyBuyerOrSeller"));
      return;
    }

    deps.escrow.setStatus(deal.id, "DISPUTED");
    const disputeUrl = buildMiniAppUrl(deps, {
      dealId: deal.id,
      action: "dispute",
    });
    await ctx.reply(
      t("dispute.opened", { dealId: deal.id }),
      Markup.inlineKeyboard([
        [Markup.button.url(t("dispute.button.open"), disputeUrl)],
        [
          Markup.button.callback(
            t("dispute.vote.buyer"),
            `vote:${deal.id}:buyer`
          ),
          Markup.button.callback(
            t("dispute.vote.seller"),
            `vote:${deal.id}:seller`
          ),
        ],
      ])
    );
    auditLog("disputeOpened", { dealId: deal.id, actor });
  });

  bot.action(/^vote:(\d+):(buyer|seller)$/, async (ctx) => {
    const t = createT();
    const dealId = Number(ctx.match[1]);
    const side = ctx.match[2];
    const sideLabel = side === "buyer" ? t("side.buyer") : t("side.seller");
    const deal = deps.escrow.getDeal(dealId);
    if (!deal) {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "vote", dealId },
        run: () => ctx.answerCbQuery(t("error.dealNotFound")),
      });
      return;
    }

    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "vote", dealId: deal.id },
      run: () =>
        ctx.answerCbQuery(t("dispute.vote.recorded", { side: sideLabel })),
    });
    await withTelegramApiGuard({
      action: "reply",
      meta: { command: "vote", dealId: deal.id },
      run: () =>
        ctx.reply(
          t("dispute.vote.submitted", { dealId: deal.id, side: sideLabel })
        ),
    });

    auditLog("voteIntent", {
      dealId: deal.id,
      side,
      actor: ctx.from?.username || "unknown",
    });
  });
}
