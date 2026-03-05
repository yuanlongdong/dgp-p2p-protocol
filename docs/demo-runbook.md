# DGP-P2P Demo Runbook

## 本地测试
cd ~/dgp-p2p-protocol
pnpm install
pnpm --filter @dgp/contracts test
pnpm build

## Arbitrum Sepolia 部署
cd ~/dgp-p2p-protocol/packages/contracts
cp .env.example .env
# 填 PRIVATE_KEY + ARB_SEPOLIA_RPC_URL
cd ~/dgp-p2p-protocol
pnpm --filter @dgp/contracts run deploy:arb-sepolia

## Optimism Sepolia 部署
cd ~/dgp-p2p-protocol/packages/contracts
cp .env.example .env
# 填 PRIVATE_KEY + OP_SEPOLIA_RPC_URL
cd ~/dgp-p2p-protocol
pnpm --filter @dgp/contracts run deploy:op-sepolia

## 前端环境变量
- `VITE_ESCROW_FACTORY=<部署输出地址>`
- `VITE_DISPUTE_MODULE=<部署输出地址>`
- `VITE_SUBGRAPH_URL=<The Graph query endpoint>`

## Subgraph 地址同步
```bash
pnpm subgraph:sync:arb   # 从 contracts/deployments/arbSepolia.json 写入 manifest
pnpm subgraph:build
```
