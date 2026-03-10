import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type DealStatus =
  | "CREATED"
  | "FUNDED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

export type Deal = {
  id: number;
  chatId: number;
  buyerId: number;
  buyerUsername: string;
  sellerUsername: string;
  amount: string;
  token: string;
  contractEscrowId?: number;
  escrowAddress?: string;
  disputeId?: number;
  status: DealStatus;
  createdAt: number;
};

export class EscrowService {
  private nextId = 1;
  private deals = new Map<number, Deal>();
  private escrowIdToDealId = new Map<number, number>();
  private disputeIdToDealId = new Map<number, number>();
  private readonly storePath: string;

  constructor(storePath?: string) {
    this.storePath = EscrowService.resolveStorePath(storePath);
    this.load();
  }

  private static resolveStorePath(storePath?: string): string {
    const normalized = storePath?.trim();
    if (normalized) return normalized;
    return path.join(process.cwd(), "apps", "telegram-bot", "data", "deals.json");
  }

  private load() {
    if (!fs.existsSync(this.storePath)) return;
    try {
      const raw = fs.readFileSync(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as { nextId: number; deals: Deal[] };
      this.nextId = parsed.nextId || 1;
      this.deals = new Map(parsed.deals.map((deal) => [deal.id, deal]));
      this.escrowIdToDealId.clear();
      this.disputeIdToDealId.clear();
      for (const deal of this.deals.values()) {
        if (deal.contractEscrowId !== undefined) this.escrowIdToDealId.set(deal.contractEscrowId, deal.id);
        if (deal.disputeId !== undefined) this.disputeIdToDealId.set(deal.disputeId, deal.id);
      }
    } catch {
      // Ignore corrupted local store; runtime still works in memory.
    }
  }

  private persist() {
    const payload = {
      nextId: this.nextId,
      deals: Array.from(this.deals.values())
    };
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(payload, null, 2) + "\n");
  }

  createDeal(input: {
    chatId: number;
    buyerId: number;
    buyerUsername: string;
    sellerUsername: string;
    amount: string;
    token: string;
  }): Deal {
    let dealId = this.generateDealId(input.chatId);
    while (this.deals.has(dealId)) {
      dealId = this.generateDealId(input.chatId);
    }

    const deal: Deal = {
      id: dealId,
      chatId: input.chatId,
      buyerId: input.buyerId,
      buyerUsername: input.buyerUsername,
      sellerUsername: input.sellerUsername,
      amount: input.amount,
      token: input.token.toUpperCase(),
      status: "CREATED",
      createdAt: Date.now()
    };
    this.deals.set(deal.id, deal);
    this.nextId += 1;
    this.persist();
    return deal;
  }

  private generateDealId(chatId: number): number {
    const seed = `${chatId}:${Date.now()}:${Math.random()}:${crypto.randomBytes(8).toString("hex")}`;
    const hex = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
    const raw = Number.parseInt(hex, 16);
    return 100000 + (raw % 900000);
  }

  getDeal(id: number): Deal | undefined {
    return this.deals.get(id);
  }

  listDealsByUser(username: string): Deal[] {
    return Array.from(this.deals.values()).filter(
      (deal) => deal.buyerUsername === username || deal.sellerUsername === username
    );
  }

  setStatus(id: number, status: DealStatus): Deal | undefined {
    const deal = this.deals.get(id);
    if (!deal) return undefined;
    deal.status = status;
    this.deals.set(id, deal);
    this.persist();
    return deal;
  }

  bindEscrowId(telegramDealId: number, contractEscrowId: number, escrowAddress?: string): Deal | undefined {
    const deal = this.deals.get(telegramDealId);
    if (!deal) return undefined;
    deal.contractEscrowId = contractEscrowId;
    if (escrowAddress) deal.escrowAddress = escrowAddress;
    this.deals.set(deal.id, deal);
    this.escrowIdToDealId.set(contractEscrowId, deal.id);
    this.persist();
    return deal;
  }

  bindDisputeIdByEscrowId(contractEscrowId: number, disputeId: number): Deal | undefined {
    const telegramDealId = this.escrowIdToDealId.get(contractEscrowId);
    if (!telegramDealId) return undefined;
    const deal = this.deals.get(telegramDealId);
    if (!deal) return undefined;
    deal.disputeId = disputeId;
    deal.status = "DISPUTED";
    this.deals.set(deal.id, deal);
    this.disputeIdToDealId.set(disputeId, deal.id);
    this.persist();
    return deal;
  }

  getByContractEscrowId(contractEscrowId: number): Deal | undefined {
    const telegramDealId = this.escrowIdToDealId.get(contractEscrowId);
    if (!telegramDealId) return undefined;
    return this.deals.get(telegramDealId);
  }

  getByDisputeId(disputeId: number): Deal | undefined {
    const telegramDealId = this.disputeIdToDealId.get(disputeId);
    if (!telegramDealId) return undefined;
    return this.deals.get(telegramDealId);
  }

  listEscrowAddresses(): string[] {
    return Array.from(this.deals.values())
      .map((deal) => deal.escrowAddress)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
  }

  listTrackedEscrowIds(): number[] {
    return Array.from(this.escrowIdToDealId.keys());
  }

  listAllDeals(): Deal[] {
    return Array.from(this.deals.values());
  }

  findMostRecentUnboundDealByBuyer(username: string): Deal | undefined {
    return Array.from(this.deals.values())
      .filter((deal) => deal.buyerUsername === username && deal.contractEscrowId === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  linkEscrowCreatedFromChain(input: {
    contractEscrowId: number;
    buyerAddress: string;
    sellerAddress: string;
    escrowAddress: string;
  }): Deal | undefined {
    const candidate = Array.from(this.deals.values())
      .filter((deal) => deal.contractEscrowId === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!candidate) return undefined;
    return this.bindEscrowId(candidate.id, input.contractEscrowId, input.escrowAddress);
  }

  bindDisputeId(telegramDealId: number, disputeId: number): Deal | undefined {
    const deal = this.deals.get(telegramDealId);
    if (!deal) return undefined;
    deal.disputeId = disputeId;
    this.deals.set(deal.id, deal);
    this.disputeIdToDealId.set(disputeId, deal.id);
    this.persist();
    return deal;
  }
}
