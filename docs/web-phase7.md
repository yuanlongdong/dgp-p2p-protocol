# Web Phase7 使用说明

## 1) 环境变量
cd ~/dgp-p2p-protocol/apps/web
cp .env.example .env
# 填入 VITE_RPC_URL / VITE_ESCROW_FACTORY / VITE_DISPUTE_MODULE

## 2) 启动（本地）
cd ~/dgp-p2p-protocol
pnpm --filter @dgp/web dev

## 3) 当前状态
- 已有创建Escrow/争议/查询的交互页面骨架
- 下一步接入 wagmi + viem 实际链上读写
