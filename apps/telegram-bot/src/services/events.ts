import { Telegraf } from "telegraf";
import { parseAbiItem } from "viem";
import { createRpcClient } from "./rpc";
import { SupportedNetwork } from "../config/networks";

type EventRelayConfig = {
  network: SupportedNetwork;
  rpcUrl?: string;
  announceChatId?: string;
  escrowFactory?: `0x${string}`;
  disputeModule?: `0x${string}`;
};

export function startEventRelay(bot: Telegraf, config: EventRelayConfig) {
  if (!config.announceChatId) return;
  const client = createRpcClient(config.network, config.rpcUrl);
  const chatId = Number(config.announceChatId);
  if (!Number.isFinite(chatId)) return;

  const send = async (text: string) => {
    try {
      await bot.telegram.sendMessage(chatId, text);
    } catch {
      // Ignore relay errors to avoid crashing bot runtime.
    }
  };

  if (config.escrowFactory) {
    const escrowAbi = [
      parseAbiItem(
        "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address escrow)"
      )
    ] as const;
    (client as any).watchContractEvent({
      address: config.escrowFactory,
      abi: escrowAbi,
      eventName: "EscrowCreated",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const escrowId = String(log.args?.escrowId ?? "");
          send(`🔔 Escrow Created\nDeal #${escrowId}`);
        }
      }
    });
  }

  if (config.disputeModule) {
    const disputeAbi = [
      parseAbiItem("event DisputeOpened(uint256 indexed disputeId, address indexed escrow)")
    ] as const;
    (client as any).watchContractEvent({
      address: config.disputeModule,
      abi: disputeAbi,
      eventName: "DisputeOpened",
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const disputeId = String(log.args?.disputeId ?? "");
          send(`⚠️ Dispute Opened\nDispute #${disputeId}`);
        }
      }
    });
  }
}
