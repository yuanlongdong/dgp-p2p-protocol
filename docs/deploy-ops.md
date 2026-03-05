# Deploy & Ops Runbook

## GitHub Secrets
配置以下仓库级 secrets：
- `PRIVATE_KEY`
- `ARB_SEPOLIA_RPC_URL`
- `OP_SEPOLIA_RPC_URL`

## 手动部署（GitHub Actions）
1. 打开 `Actions` -> `deploy-sepolia-manual`
2. 点击 `Run workflow`
3. 选择 `arbSepolia` 或 `opSepolia`
4. 部署产物会作为 artifact 上传（`packages/contracts/deployments/*.json`）

## 本地部署
```bash
cd packages/contracts
cp .env.example .env
# 填 PRIVATE_KEY + RPC
pnpm deploy:arb-sepolia
pnpm deploy:op-sepolia
```

## Subgraph 同步与构建
```bash
pnpm subgraph:sync:arb
pnpm subgraph:build
```

## 回滚策略
- 合约是不可变部署，回滚采用“切换地址”策略。
- 如果新部署异常：
  1. 前端环境变量回退到上一版本地址
  2. Subgraph manifest 同步到旧地址并重建
  3. 暂停相关 UI 写操作入口
