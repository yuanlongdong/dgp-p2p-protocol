export type Locale = "zh-CN" | "en";

const translations: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    // Commands
    "usage.deal": "用法：/deal @卖家 数量 代币",
    "usage.pay": "用法：/pay <dealId> [escrowId]",
    "usage.release": "用法：/release <dealId>",
    "usage.dispute": "用法：/dispute <dealId>",
    "usage.status": "用法：/status <dealId>",
    "error.dealNotFound": "未找到该交易。",
    "error.onlyBuyer": "仅买家可以执行 {cmd}。",
    "error.onlyBuyerConfirm": "仅买家可以确认释放",
    "error.onlyBuyerOrSeller": "仅买家或卖家可以执行 /dispute。",
    "error.buyerUsernameRequired": "需要买家用户名，请先设置 Telegram 用户名。",
    "error.invalidAmount": "数量格式不正确。",
    "deal.openEscrow": "打开托管",
    "deal.fundsSecured": "资金由智能合约托管。\n管理员无法触碰资金。\n打开托管：",
    "pay.title": "交易 #{dealId}\n金额：{amount} {token}\n操作：fundEscrow()\n{binding}",
    "pay.binding.bound": "已绑定 EscrowId：{escrowId}",
    "pay.binding.tip": "提示：使用 /pay <dealId> <escrowId> 绑定映射。",
    "pay.button": "支付托管",
    "release.prompt": "确认释放交易 #{dealId} 的托管资金？",
    "release.confirm": "确认释放",
    "release.onchain": "链上确认释放",
    "release.sign": "交易 #{dealId}\n请在 MiniApp 中签署 releaseEscrow()。",
    "release.cb.generated": "已生成释放确认",
    "dispute.opened": "⚠️ 已发起争议\n交易 #{dealId}\n投票窗口：24 小时",
    "dispute.button.open": "打开争议",
    "dispute.vote.buyer": "投票给买家",
    "dispute.vote.seller": "投票给卖家",
    "side.buyer": "买家",
    "side.seller": "卖家",
    "dispute.vote.recorded": "已记录投票：{side}",
    "dispute.vote.submitted": "已为交易 #{dealId} 提交投票（{side}）。\n下一步：在 MiniApp 中调用 vote(disputeId, sellerBps)。",
    "status.escrowAddress": "托管地址：{address}",
    "status.none": "暂无交易记录。",
    "status.escrowId": "托管Id",
    "status.disputeId": "争议Id",
    "status.item": "#{id} {amount} {token} {buyer}->{seller} {status}{escrowId}{disputeId}",
    "help.title": "DGP 托管机器人",
    "help.officialFactory": "官方合约地址：{address}",
    "help.notSet": "未设置",
    "help.secured": "资金由智能合约托管。",
    "help.noAdminAccess": "管理员无法触碰资金。",
    "help.offline": "支持离线演示模式（不涉及链上资金）。",
    "help.available": "可用命令：",
    "card.title": "━━━━━━━━━━ 托管交易 ━━━━━━━━━━",
    "card.deal": "交易：#{id}",
    "card.buyer": "买家：@{buyer}",
    "card.seller": "卖家：@{seller}",
    "card.amount": "金额：{amount} {token}",
    "card.status": "状态：{status}",
    "card.footer": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    // Events -> chat relay
    "relay.escrowFunded": "✅ 托管已入金\n交易 #{dealId}\n金额：{amount}",
    "relay.escrowReleased": "🔔 托管已释放\n交易 #{dealId}\n卖家已收款：{amount}",
    "relay.escrowCreated": "🧾 已链上创建托管\nTelegram 交易 #{dealId}\nEscrowId：{escrowId}\n托管地址：{escrowAddress}",
    "relay.escrowCreatedUnbound": "🧾 已创建托管\nEscrowId：{escrowId}\n托管地址：{escrowAddress}",
    "relay.disputeOpened": "⚠️ 争议已开启\n交易 #{dealId}\n争议 ID：{disputeId}",
    "relay.voteCast": "🗳 已投票\n交易 #{dealId}\n争议 ID：{disputeId}\n票数：{votes}\n卖家占比（均值）：{sellerBps}",
    // Logs
    "log.botStarted": "机器人已启动",
    "log.escrowFunded": "托管入金",
    "log.escrowReleased": "托管释放",
    "log.escrowCreated": "托管创建",
    "log.escrowCreatedUnbound": "托管创建（未绑定）",
    "log.disputeOpened": "争议开启",
    "log.voteCast": "投票已提交",
    "log.dealCreated": "交易已创建",
    "log.voteIntent": "投票意向",
    "log.releaseRequested": "释放请求",
    "log.releaseConfirmGenerated": "释放确认已生成",
    "log.dealMappingBound": "交易映射已绑定",
    "log.payRequested": "支付请求",
    "log.telegramInitDataRejected": "Telegram initData 校验失败",
    "log.telegramInitDataVerified": "Telegram initData 校验通过",
    "log.telegramAuthServerStarted": "Telegram 鉴权服务已启动"
  },
  en: {
    "usage.deal": "Usage: /deal @seller amount token",
    "usage.pay": "Usage: /pay <dealId> [escrowId]",
    "usage.release": "Usage: /release <dealId>",
    "usage.dispute": "Usage: /dispute <dealId>",
    "usage.status": "Usage: /status <dealId>",
    "error.dealNotFound": "Deal not found.",
    "error.onlyBuyer": "Only buyer can run {cmd}.",
    "error.onlyBuyerConfirm": "Only buyer can confirm release",
    "error.onlyBuyerOrSeller": "Only buyer or seller can run /dispute.",
    "error.buyerUsernameRequired": "Buyer username required. Please set Telegram username.",
    "error.invalidAmount": "Invalid amount.",
    "deal.openEscrow": "Open Escrow",
    "deal.fundsSecured": "Funds secured by smart contract.\nAdmin cannot access funds.\nOpen secure escrow:",
    "pay.title": "Deal #{dealId}\nAmount: {amount} {token}\nAction: fundEscrow()\n{binding}",
    "pay.binding.bound": "Bound EscrowId: {escrowId}",
    "pay.binding.tip": "Tip: use /pay <dealId> <escrowId> to bind mapping.",
    "pay.button": "Pay Escrow",
    "release.prompt": "Release escrow for deal #{dealId}?",
    "release.confirm": "Confirm Release",
    "release.onchain": "Confirm Release On-Chain",
    "release.sign": "Deal #{dealId}\nPlease sign releaseEscrow() in MiniApp.",
    "release.cb.generated": "Release confirmation generated",
    "dispute.opened": "⚠️ Dispute opened\nDeal #{dealId}\nVoting window: 24h",
    "dispute.button.open": "Open Dispute",
    "dispute.vote.buyer": "Vote Buyer",
    "dispute.vote.seller": "Vote Seller",
    "side.buyer": "buyer",
    "side.seller": "seller",
    "dispute.vote.recorded": "Vote recorded for {side}",
    "dispute.vote.submitted": "Vote submitted for deal #{dealId} ({side}).\nNext: call vote(disputeId, sellerBps) in MiniApp.",
    "status.escrowAddress": "EscrowAddress: {address}",
    "status.none": "No deals found.",
    "status.escrowId": "escrowId",
    "status.disputeId": "disputeId",
    "status.item": "#{id} {amount} {token} {buyer}->{seller} {status}{escrowId}{disputeId}",
    "help.title": "DGP Escrow Bot",
    "help.officialFactory": "Official contract address: {address}",
    "help.notSet": "NOT_SET",
    "help.secured": "Funds secured by smart contract.",
    "help.noAdminAccess": "Admin cannot access funds.",
    "help.offline": "Offline demo mode available (no on-chain funds).",
    "help.available": "Available commands:",
    "card.title": "━━━━━━━━━━ ESCROW DEAL ━━━━━━━━━━",
    "card.deal": "Deal: #{id}",
    "card.buyer": "Buyer: @{buyer}",
    "card.seller": "Seller: @{seller}",
    "card.amount": "Amount: {amount} {token}",
    "card.status": "Status: {status}",
    "card.footer": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "relay.escrowFunded": "✅ Escrow funded\nDeal #{dealId}\nAmount: {amount}",
    "relay.escrowReleased": "🔔 Escrow Released\nDeal #{dealId}\nSeller paid: {amount}",
    "relay.escrowCreated": "🧾 Escrow Created On-Chain\nTelegram Deal #{dealId}\nEscrowId: {escrowId}\nEscrow: {escrowAddress}",
    "relay.escrowCreatedUnbound": "🧾 Escrow Created\nEscrowId: {escrowId}\nEscrow: {escrowAddress}",
    "relay.disputeOpened": "⚠️ Dispute Opened\nDeal #{dealId}\nDisputeId: {disputeId}",
    "relay.voteCast": "🗳 VoteCast\nDeal #{dealId}\nDisputeId: {disputeId}\nVotes: {votes}\nSellerBps(avg): {sellerBps}",
    "log.botStarted": "Bot started",
    "log.escrowFunded": "Escrow funded",
    "log.escrowReleased": "Escrow released",
    "log.escrowCreated": "Escrow created",
    "log.escrowCreatedUnbound": "Escrow created (unbound)",
    "log.disputeOpened": "Dispute opened",
    "log.voteCast": "Vote cast",
    "log.dealCreated": "Deal created",
    "log.voteIntent": "Vote intent",
    "log.releaseRequested": "Release requested",
    "log.releaseConfirmGenerated": "Release confirm generated",
    "log.dealMappingBound": "Deal mapping bound",
    "log.payRequested": "Pay requested",
    "log.telegramInitDataRejected": "Telegram initData rejected",
    "log.telegramInitDataVerified": "Telegram initData verified",
    "log.telegramAuthServerStarted": "Telegram auth server started"
  }
};

export function resolveLocale(): Locale {
  const raw = (process.env.DGP_LANG || process.env.DGP_BOT_LANG || process.env.LANG || "").toLowerCase();
  return raw.startsWith("en") ? "en" : "zh-CN";
}

export function createT(locale: Locale = resolveLocale()) {
  return (key: string, params: Record<string, string | number> = {}) => {
    const template = translations[locale][key] ?? translations["zh-CN"][key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
  };
}

export function formatEventMessage(event: string, payload: Record<string, unknown>, locale: Locale) {
  const t = createT(locale);
  const safe = (value: unknown, fallback = "-") => {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  };
  const map: Record<string, string> = {
    botStarted: t("log.botStarted"),
    escrowFunded: t("log.escrowFunded"),
    escrowReleased: t("log.escrowReleased"),
    escrowCreated: t("log.escrowCreated"),
    escrowCreatedUnbound: t("log.escrowCreatedUnbound"),
    disputeOpened: t("log.disputeOpened"),
    voteCast: t("log.voteCast"),
    dealCreated: t("log.dealCreated"),
    voteIntent: t("log.voteIntent"),
    releaseRequested: t("log.releaseRequested"),
    releaseConfirmGenerated: t("log.releaseConfirmGenerated"),
    dealMappingBound: t("log.dealMappingBound"),
    payRequested: t("log.payRequested"),
    telegramInitDataRejected: t("log.telegramInitDataRejected"),
    telegramInitDataVerified: t("log.telegramInitDataVerified"),
    telegramAuthServerStarted: t("log.telegramAuthServerStarted")
  };
  if (!map[event]) return undefined;
  const details = [
    payload.dealId ? `dealId=${safe(payload.dealId)}` : "",
    payload.escrowId ? `escrowId=${safe(payload.escrowId)}` : "",
    payload.disputeId ? `disputeId=${safe(payload.disputeId)}` : "",
    payload.amount ? `amount=${safe(payload.amount)}` : ""
  ].filter(Boolean);
  return details.length ? `${map[event]} (${details.join(", ")})` : map[event];
}
