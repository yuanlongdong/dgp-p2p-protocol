import { Telegraf } from "telegraf";

const HELP_TEXT = [
  "Available commands:",
  "/start",
  "/deal @seller amount token",
  "/pay <dealId>",
  "/release <dealId>",
  "/dispute <dealId>",
  "/status [dealId]",
  "/help"
].join("\n");

export function registerHelp(bot: Telegraf) {
  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });
}
