import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN || "";
if (!token) {
  console.error("[telegram-bot] TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Telegraf(token);

const HELP_TEXT = `DGP-P2P 中文助手

常用命令：
/start - 初始化
/help - 查看帮助
/guide - 交易流程指引
/risk - 风控与争议建议
/ops - 运营排障入口`;

const GUIDE_TEXT = `基础流程：
1. 在 Mini App / Web 创建 Escrow
2. 买方 fund
3. 正常成交后 release
4. 争议时 markDispute + openDispute
5. 调解员投票或 Kleros 路由`;

const RISK_TEXT = `风控建议：
1. 仅使用白名单代币与官方前端
2. 大额交易启用 guarantor
3. 遇到异常价格波动时暂停新单
4. 争议中务必提交完整证据 CID`;

bot.start((ctx) => ctx.reply("欢迎使用 DGP-P2P 助手。\n" + HELP_TEXT));
bot.help((ctx) => ctx.reply(HELP_TEXT));
bot.command("guide", (ctx) => ctx.reply(GUIDE_TEXT));
bot.command("risk", (ctx) => ctx.reply(RISK_TEXT));
bot.command("ops", (ctx) => ctx.reply("运营入口：请联系管理员并提供 TxHash / EscrowId / DisputeId。"));

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.includes("争议")) return ctx.reply("争议处理：先 markDispute，再 openDispute，随后等待投票/仲裁。");
  if (text.includes("担保")) return ctx.reply("担保交易：建议使用 createEscrowWithGuarantor 并确保抵押率 >= 150%。");
  if (text.includes("KYC") || text.includes("AML")) return ctx.reply("合规模块：支持 KYC、黑名单、制裁、风险分阈值控制。");
  return ctx.reply("收到。发送 /help 查看可用命令。");
});

bot.launch().then(() => {
  console.log("[telegram-bot] started");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
