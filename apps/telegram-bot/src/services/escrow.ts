export type DealStatus =
  | "CREATED"
  | "FUNDED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "DISPUTED";

export type Deal = {
  id: number;
  chatId: number;
  buyerId: number;
  buyerUsername: string;
  sellerUsername: string;
  amount: string;
  token: string;
  status: DealStatus;
  createdAt: number;
};

export class EscrowService {
  private nextId = 1;
  private deals = new Map<number, Deal>();

  createDeal(input: {
    chatId: number;
    buyerId: number;
    buyerUsername: string;
    sellerUsername: string;
    amount: string;
    token: string;
  }): Deal {
    const deal: Deal = {
      id: this.nextId++,
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
    return deal;
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
    return deal;
  }
}
