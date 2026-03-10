import "dotenv/config";
import { Telegraf } from "telegraf";
import { registerHelp } from "./commands/help";
import { registerDeal } from "./commands/deal";
import { registerPay } from "./commands/pay";
import { registerRelease } from "./commands/release";
import { registerDispute } from "./commands/dispute";
import { registerStatus } from "./commands/status";
import { EscrowService } from "./services/escrow";
import { startEventRelay } from "./services/events";
import { SupportedNetwork } from "./config/networks";
import { auditLog } from "./services/audit-log";
import { startTelegramAuthServer } from "./services/telegram-auth";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const botToken = requiredEnv("BOT_TOKEN");
const botUsername = requiredEnv("BOT_USERNAME");
const miniAppBaseUrl = requiredEnv("MINIAPP_URL");
const escrowFactory = requiredEnv("ESCROW_FACTORY") as `0x${string}`;
const disputeModule = requiredEnv("DISPUTE_MODULE") as `0x${string}`;
const deepLinkSecret = requiredEnv("DEEPLINK_SECRET");
const network = (process.env.DGP_NETWORK || "arbSepolia") as SupportedNetwork;
const authServerPort = Number(process.env.AUTH_SERVER_PORT || "8787");

const bot = new Telegraf(botToken);
const dealStorePath = optionalEnv("DEAL_STORE_PATH");
const escrow = new EscrowService(dealStorePath);
const deps = { escrow, miniAppBaseUrl, botUsername, deepLinkSecret };

bot.catch((err, ctx) => {
  const error = err instanceof Error ? err : new Error(String(err));
  auditLog("botUpdateError", {
    updateType: ctx.updateType,
    errorName: error.name,
    errorMessage: error.message,
  });
});

registerHelp(bot, { officialFactory: escrowFactory });
registerDeal(bot, deps);
registerPay(bot, deps);
registerRelease(bot, deps);
registerDispute(bot, deps);
registerStatus(bot, deps);

startEventRelay(bot, {
  network,
  rpcUrl: optionalEnv("RPC_URL"),
  announceChatId: optionalEnv("TELEGRAM_ANNOUNCE_CHAT_ID"),
  escrowFactory,
  disputeModule,
  escrow,
});

if (Number.isFinite(authServerPort) && authServerPort > 0) {
  startTelegramAuthServer({
    botToken,
    port: authServerPort,
  });
}

bot.launch().then(() => {
  auditLog("botStarted", {
    network,
    miniAppBaseUrl,
    escrowFactory,
    disputeModule,
  });
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
