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
- `VITE_DGP_GOVERNOR=<部署输出地址>`
- `VITE_COMPLIANCE_REGISTRY=<部署输出地址>`
- `VITE_SUBGRAPH_URL=<The Graph query endpoint>`

## 一键回填演示环境变量
```bash
# 读取 packages/contracts/deployments/arbSepolia.json 并生成 web/miniapp env
pnpm demo:prepare:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"
```
生成文件：
- `apps/web/.env.local`
- `apps/miniapp/.env.local`

## 端到端演示流水线（推荐）
```bash
# deployment 文件已存在时：
pnpm demo:e2e:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"

# 若只想准备 env 且跳过 web/miniapp build：
node scripts/ops/e2e-demo.mjs arbSepolia "https://api.studio.thegraph.com/query/<id>/<name>/latest" --skip-ui-build
```

## Subgraph 地址同步
```bash
pnpm subgraph:sync:arb   # 从 contracts/deployments/arbSepolia.json 写入 manifest
pnpm subgraph:build
```
