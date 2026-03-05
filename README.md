# DGP-P2P
去中心化 P2P 担保系统（Escrow + Guarantor + Dispute + Telegram Mini App + Web + Subgraph）。

## Quick Start
```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --ignore-scripts
pnpm test:contracts
pnpm build
```

## Deploy Contracts
```bash
cd packages/contracts
cp .env.example .env
# fill PRIVATE_KEY + RPC URL
pnpm deploy:arb-sepolia
pnpm deploy:op-sepolia
```

## Ops Docs
- `docs/demo-runbook.md`
- `docs/deploy-ops.md`
