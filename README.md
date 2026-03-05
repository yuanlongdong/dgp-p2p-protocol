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

## Frontend Env
Web (`apps/web/.env`):
- `VITE_ESCROW_FACTORY`
- `VITE_DISPUTE_MODULE`
- `VITE_DGP_GOVERNOR`
- `VITE_SUBGRAPH_URL`

Mini App (`apps/miniapp/.env`):
- `VITE_ESCROW_FACTORY`
- `VITE_DGP_GOVERNOR`
- `VITE_COMPLIANCE_REGISTRY`

## One-Command Demo Env
```bash
# Arbitrum Sepolia
pnpm demo:prepare:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"

# Optimism Sepolia
pnpm demo:prepare:op -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"
```
该命令会读取 `packages/contracts/deployments/<network>.json` 并写入：
- `apps/web/.env.local`
- `apps/miniapp/.env.local`

## End-to-End Demo Pipeline
```bash
# 已有 deployment json 的情况下，一键串联：
# subgraph sync -> subgraph build -> env 回填 -> web/miniapp build
pnpm demo:e2e:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"

# 如需从本地直接部署再执行全流程：
node scripts/ops/e2e-demo.mjs arbSepolia --deploy "https://api.studio.thegraph.com/query/<id>/<name>/latest"
```

## Ops Docs
- `docs/demo-runbook.md`
- `docs/deploy-ops.md`
- `docs/status-matrix.md`
