import { Telegraf } from "telegraf";
import {
  buildDealActionKeyboard,
  buildMiniAppLaunchKeyboard,
  canRunAction,
  CommandDeps,
  formatDealDetails,
} from "./types";
import { auditLog } from "../services/audit-log";
import { createT } from "../i18n";
import { withTelegramApiGuard } from "../services/telegram-safe";

async function renderReleaseEntry(
  ctx: any,
  deps: CommandDeps,
  dealId: number,
  mode: "reply" | "edit"
) {
  const t = createT();
  const deal = deps.escrow.getDeal(dealId);
  if (!deal) {
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "release", dealId },
        run: () => ctx.answerCbQuery(t("error.dealNotFound")),
      });
      return;
    }
    await ctx.reply(t("error.dealNotFound"));
    return;
  }

  const actor = ctx.from?.username;
  if (!actor || actor !== deal.buyerUsername) {
    const msg = t("error.onlyBuyer", { cmd: "/release" });
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "release", dealId },
        run: () => ctx.answerCbQuery(msg),
      });
      return;
    }
    await ctx.reply(msg);
    return;
  }

  if (!canRunAction(deal.status, "release")) {
    const text = `${formatDealDetails(deal, t)}\n\n${t("error.actionUnavailable")}\n${t("panel.status")}`;
    if (mode === "edit") {
      await withTelegramApiGuard({
        action: "editMessageText",
        meta: { command: "release", dealId },
        run: () => ctx.editMessageText(text, buildDealActionKeyboard(deal, t)),
      });
      await withTelegramApiGuard({
        action: "answerCbQuery",
        meta: { command: "release", dealId },
        run: () => ctx.answerCbQuery(t("error.actionUnavailable")),
      });
      return;
    }
    await ctx.reply(text, buildDealActionKeyboard(deal, t));
    return;
  }

  deps.escrow.setStatus(deal.id, "RELEASE_PENDING");
  const latestDeal = deps.escrow.getDeal(deal.id)!;
  const text = `${formatDealDetails(latestDeal, t)}\n\n${t("release.sign", { dealId: latestDeal.id })}`;
  const keyboard = buildMiniAppLaunchKeyboard(deps, latestDeal, t, "release");

  if (mode === "edit") {
    await withTelegramApiGuard({
      action: "editMessageText",
      meta: { command: "release", dealId },
      run: () => ctx.editMessageText(text, keyboard),
    });
    await withTelegramApiGuard({
      action: "answerCbQuery",
      meta: { command: "release", dealId },
      run: () => ctx.answerCbQuery(t("release.cb.generated")),
    });
  } else {
    await ctx.reply(text, keyboard);
  }

  auditLog("releaseRequested", { dealId: latestDeal.id, actor });
  auditLog("releaseConfirmGenerated", { dealId: latestDeal.id, actor });
}

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

    await renderReleaseEntry(ctx, deps, dealId, "reply");
  });

  bot.action(/^deal:release:(\d+)$/, async (ctx) => {
    const dealId = Number(ctx.match[1]);
    await renderReleaseEntry(ctx, deps, dealId, "edit");
  });
}
