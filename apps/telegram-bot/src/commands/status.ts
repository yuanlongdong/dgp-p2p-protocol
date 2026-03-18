import { Telegraf } from "telegraf";
import {
  buildDealActionKeyboard,
  CommandDeps,
  formatDealDetails,
} from "./types";
import { createT } from "../i18n";
import { withTelegramApiGuard } from "../services/telegram-safe";

async function sendDealStatus(ctx: any, deps: CommandDeps, dealId: number, mode: "reply" | "edit") {
  const t = createT();
  const deal = deps.escrow.getDeal(dealId);
  if (!deal) {
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "status", dealId },
        run: () => ctx.answerCbQuery(t("error.dealNotFound")),
      });
      return;
    }
    await ctx.reply(t("error.dealNotFound"));
    return;
  }

  const text = `${formatDealDetails(deal, t)}\n\n${t("panel.status")}`;
  const keyboard = buildDealActionKeyboard(deal, t);

  if (mode === "edit") {
    await withTelegramApiGuard({
      action: "editMessageText",
      meta: { command: "status", dealId },
      run: () => ctx.editMessageText(text, keyboard),
    });
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "status", dealId },
      run: () => ctx.answerCbQuery(t("status.refreshed")),
    });
    return;
  }

  await ctx.reply(text, keyboard);
}

export function registerStatus(bot: Telegraf, deps: CommandDeps) {
  bot.command("status", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);

    if (Number.isInteger(dealId) && dealId > 0) {
      await sendDealStatus(ctx, deps, dealId, "reply");
      return;
    }

    const username = ctx.from?.username;
    if (!username) {
      await ctx.reply(t("usage.status"));
      return;
    }
    const deals = deps.escrow.listDealsByUser(username).slice(-5).reverse();
    if (deals.length === 0) {
      await ctx.reply(t("status.none"));
      return;
    }

    for (const deal of deals) {
      await ctx.reply(
        `${formatDealDetails(deal, t)}\n\n${t("panel.status")}`,
        buildDealActionKeyboard(deal, t)
      );
    }
  });

  bot.action(/^deal:status:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    await sendDealStatus(ctx, deps, dealId, "edit");
  });
}
