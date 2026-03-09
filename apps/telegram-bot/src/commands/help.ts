import { Telegraf } from "telegraf";

export function registerHelp(bot: Telegraf, opts?: { officialFactory?: string }) {
  const helpText = [
    "DGP Escrow Bot",
    `Official contract address: ${opts?.officialFactory || "NOT_SET"}`,
    "Funds secured by smart contract.",
    "Admin cannot access funds.",
    "",
    "Available commands:",
    "/start",
    "/deal @seller amount token",
    "/pay <dealId> [escrowId]",
    "/release <dealId>",
    "/dispute <dealId>",
    "/status [dealId]",
    "/help"
  ].join("\n");

  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(helpText);
  });
}
