import { Telegraf } from "telegraf";
import { createT } from "../i18n";

export function registerHelp(bot: Telegraf, opts?: { officialFactory?: string }) {
  bot.command(["start", "help"], async (ctx) => {
    const t = createT();
    const official = opts?.officialFactory || t("help.notSet");
    const helpText = [
      t("help.title"),
      t("help.officialFactory", { address: official }),
      t("help.secured"),
      t("help.noAdminAccess"),
      t("help.offline"),
      "",
      t("help.available"),
      "/start",
      "/deal @seller amount token",
      "/pay <dealId> [escrowId]",
      "/release <dealId>",
      "/dispute <dealId>",
      "/status [dealId]",
      "/help"
    ].join("\n");
    await ctx.reply(helpText);
  });
}
