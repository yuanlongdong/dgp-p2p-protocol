import { Telegraf } from "telegraf";
import { parseAbiItem } from "viem";
import { createRpcClient } from "./rpc";
import { SupportedNetwork } from "../config/networks";
import { EscrowService } from "./escrow";

type EventRelayConfig = {
  network: SupportedNetwork;
  rpcUrl?: string;
  announceChatId?: string;
  escrowFactory?: `0x${string}`;
  disputeModule?: `0x${string}`;
  escrow: EscrowService;
};

export function startEventRelay(bot: Telegraf, config: EventRelayConfig) {
  const client = createRpcClient(config.network, config.rpcUrl);
  const chatId = Number(config.announceChatId);
  const defaultChatId = Number.isFinite(chatId) ? chatId : undefined;
  const watchedEscrows = new Set<string>();

  const sendToChat = async (targetChatId: number | undefined, text: string) => {
    if (!targetChatId) return;
    try {
      await bot.telegram.sendMessage(targetChatId, text);
    } catch {
      // Ignore relay errors to avoid crashing bot runtime.
    }
  };

  const watchEscrowAddress = (escrowAddress: string, relatedDealId?: number, relatedChatId?: number) => {
    const key = escrowAddress.toLowerCase();
    if (watchedEscrows.has(key)) return;
    watchedEscrows.add(key);

    const escrowAbi = [
      parseAbiItem("event Funded(address indexed from, uint256 amount)"),
      parseAbiItem("event Released(address indexed to, uint256 amount)")
    ] as const;

    (client as any).watchContractEvent({
      address: escrowAddress,
      abi: escrowAbi,
      eventName: "Funded",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const amount = String(log.args?.amount ?? "");
          const deal = relatedDealId ? config.escrow.getDeal(relatedDealId) : undefined;
          if (deal) config.escrow.setStatus(deal.id, "FUNDED");
          sendToChat(deal?.chatId ?? relatedChatId ?? defaultChatId, `✅ Escrow funded\nDeal #${deal?.id ?? "?"}\nAmount: ${amount}`);
        }
      }
    });

    (client as any).watchContractEvent({
      address: escrowAddress,
      abi: escrowAbi,
      eventName: "Released",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const amount = String(log.args?.amount ?? "");
          const deal = relatedDealId ? config.escrow.getDeal(relatedDealId) : undefined;
          if (deal) config.escrow.setStatus(deal.id, "RELEASED");
          sendToChat(deal?.chatId ?? relatedChatId ?? defaultChatId, `🔔 Escrow Released\nDeal #${deal?.id ?? "?"}\nSeller paid: ${amount}`);
        }
      }
    });
  };

  for (const deal of config.escrow.listAllDeals()) {
    if (deal.escrowAddress) watchEscrowAddress(deal.escrowAddress, deal.id, deal.chatId);
  }

  if (config.escrowFactory) {
    const factoryAbi = [
      parseAbiItem(
        "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address escrow)"
      )
    ] as const;
    (client as any).watchContractEvent({
      address: config.escrowFactory,
      abi: factoryAbi,
      eventName: "EscrowCreated",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const contractEscrowId = Number(log.args?.escrowId ?? 0);
          const escrowAddress = String(log.args?.escrow ?? "");
          let linked = config.escrow.getByContractEscrowId(contractEscrowId);
          if (!linked) {
            linked = config.escrow.linkEscrowCreatedFromChain({
              contractEscrowId,
              buyerAddress: String(log.args?.buyer ?? ""),
              sellerAddress: String(log.args?.seller ?? ""),
              escrowAddress
            });
          }
          if (linked) {
            sendToChat(
              linked.chatId,
              `🧾 Escrow Created On-Chain\nTelegram Deal #${linked.id}\nEscrowId: ${contractEscrowId}\nEscrow: ${escrowAddress}`
            );
            watchEscrowAddress(escrowAddress, linked.id, linked.chatId);
          } else {
            sendToChat(defaultChatId, `🧾 Escrow Created\nEscrowId: ${contractEscrowId}\nEscrow: ${escrowAddress}`);
            watchEscrowAddress(escrowAddress, undefined, defaultChatId);
          }
        }
      }
    });
  }

  if (config.disputeModule) {
    const disputeAbi = [
      parseAbiItem("event DisputeOpened(uint256 indexed disputeId, address indexed escrow)")
      , parseAbiItem("event Voted(uint256 indexed disputeId, address indexed mediator, uint16 sellerBps, uint16 votes)")
    ] as const;
    (client as any).watchContractEvent({
      address: config.disputeModule,
      abi: disputeAbi,
      eventName: "DisputeOpened",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const disputeId = Number(log.args?.disputeId ?? 0);
          const escrowAddress = String(log.args?.escrow ?? "").toLowerCase();
          const linkedDeal = config.escrow
            .listAllDeals()
            .find((deal) => (deal.escrowAddress || "").toLowerCase() === escrowAddress);
          if (linkedDeal) {
            config.escrow.bindDisputeId(linkedDeal.id, disputeId);
          }
          const deal = linkedDeal || config.escrow.getByDisputeId(disputeId);
          sendToChat(
            deal?.chatId ?? defaultChatId,
            `⚠️ Dispute Opened\nDeal #${deal?.id ?? "?"}\nDisputeId: ${disputeId}`
          );
        }
      }
    });

    (client as any).watchContractEvent({
      address: config.disputeModule,
      abi: disputeAbi,
      eventName: "Voted",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const disputeId = Number(log.args?.disputeId ?? 0);
          const votes = Number(log.args?.votes ?? 0);
          const sellerBps = Number(log.args?.sellerBps ?? 0);
          const deal = config.escrow.getByDisputeId(disputeId);
          sendToChat(
            deal?.chatId ?? defaultChatId,
            `🗳 VoteCast\nDeal #${deal?.id ?? "?"}\nDisputeId: ${disputeId}\nVotes: ${votes}\nSellerBps(avg): ${sellerBps}`
          );
        }
      }
    });
  }
}
