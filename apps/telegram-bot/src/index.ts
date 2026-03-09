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

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN is required");
}

const miniAppBaseUrl = process.env.MINIAPP_URL || "https://example.com/miniapp";
const botUsername = process.env.BOT_USERNAME;
const network = (process.env.DGP_NETWORK || "arbSepolia") as SupportedNetwork;
const escrowFactory = process.env.ESCROW_FACTORY as `0x${string}` | undefined;
const disputeModule = process.env.DISPUTE_MODULE as `0x${string}` | undefined;

const bot = new Telegraf(botToken);
const escrow = new EscrowService(process.env.DEAL_STORE_PATH);
const deps = { escrow, miniAppBaseUrl, botUsername };

registerHelp(bot, { officialFactory: escrowFactory });
registerDeal(bot, deps);
registerPay(bot, deps);
registerRelease(bot, deps);
registerDispute(bot, deps);
registerStatus(bot, deps);

startEventRelay(bot, {
  network,
  rpcUrl: process.env.RPC_URL,
  announceChatId: process.env.TELEGRAM_ANNOUNCE_CHAT_ID,
  escrowFactory,
  disputeModule,
  escrow
});

bot.launch().then(() => {
  // eslint-disable-next-line no-console
  console.log("telegram bot started");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
