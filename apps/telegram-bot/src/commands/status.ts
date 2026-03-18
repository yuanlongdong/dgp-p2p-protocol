import { Telegraf } from "telegraf";
import { CommandDeps, formatDealCard } from "./types";
import { createT } from "../i18n";

export function registerStatus(bot: Telegraf, deps: CommandDeps) {
  bot.command("status", async (ctx) => {
    const t = createT();
    const text = "text" in ctx.message ? ctx.message.text : "";
    const parts = text.trim().split(/\s+/);
    const dealId = Number(parts[1]);

    if (Number.isInteger(dealId) && dealId > 0) {
      const deal = deps.escrow.getDeal(dealId);
      if (!deal) {
        await ctx.reply(t("error.dealNotFound"));
        return;
      }

      const reputationLine =
        deal.buyerReputation !== undefined || deal.sellerReputation !== undefined
          ? `\n${t("status.reputation", {
              buyer: deal.buyerReputation ?? "-",
              seller: deal.sellerReputation ?? "-",
              risk: deal.riskLevel || t("status.riskUnknown")
            })}`
          : "";

      await ctx.reply(
        formatDealCard(
          {
            id: deal.id,
            buyer: deal.buyerUsername,
            seller: deal.sellerUsername,
            amount: deal.amount,
            token: deal.token,
            status: `${deal.status}${
              deal.contractEscrowId ? ` | ${t("status.escrowId")}=${deal.contractEscrowId}` : ""
            }${deal.disputeId ? ` | ${t("status.disputeId")}=${deal.disputeId}` : ""}`
          },
          t
        ) +
          `\n${t("status.escrowAddress", { address: deal.escrowAddress || "-" })}${reputationLine}`
      );
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
    const body = deals
      .map((deal) => {
        const base = t("status.item", {
          id: deal.id,
          amount: deal.amount,
          token: deal.token,
          buyer: deal.buyerUsername,
          seller: deal.sellerUsername,
          status: deal.status,
          escrowId: deal.contractEscrowId ? ` ${t("status.escrowId")}=${deal.contractEscrowId}` : "",
          disputeId: deal.disputeId ? ` ${t("status.disputeId")}=${deal.disputeId}` : ""
        });
        const reputation =
          deal.buyerReputation !== undefined || deal.sellerReputation !== undefined
            ? `\n  ${t("status.reputation", {
                buyer: deal.buyerReputation ?? "-",
                seller: deal.sellerReputation ?? "-",
                risk: deal.riskLevel || t("status.riskUnknown")
              })}`
            : "";
        return `${base}${reputation}`;
      })
      .join("\n");
    await ctx.reply(body);
  });
}
