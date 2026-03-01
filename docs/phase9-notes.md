# Phase 9 Notes

## Web 已支持
- createEscrow() 写入
- openDispute() 写入
- getDispute(disputeId) 读取

## 运行
cd ~/dgp-p2p-protocol
pnpm --filter @dgp/web dev

## 环境变量（apps/web/.env）
- VITE_ESCROW_FACTORY=0x...
- VITE_DISPUTE_MODULE=0x...
- VITE_CHAIN_ID=421614
- VITE_RPC_URL=...
