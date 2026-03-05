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

## 演示环境地址回填
```bash
# 生成 apps/web/.env.local 与 apps/miniapp/.env.local
pnpm demo:prepare:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"
```

## 一键端到端验证
```bash
# 使用已有 deployment json
pnpm demo:e2e:arb -- "https://api.studio.thegraph.com/query/<id>/<name>/latest"

# 包含本地部署（需要 PRIVATE_KEY 与 RPC 环境变量）
node scripts/ops/e2e-demo.mjs arbSepolia --deploy "https://api.studio.thegraph.com/query/<id>/<name>/latest"
```

## 外部 KYC/AML 回调网关
```bash
export RPC_URL=<rpc>
export PRIVATE_KEY=<admin key>
export COMPLIANCE_REGISTRY=<registry>
export PROVIDER_SHARED_SECRET=<optional>
pnpm dev:compliance-gateway
```

## 运行健康检查
```bash
pnpm ops:healthcheck:arb -- "<rpc_url>" "<subgraph_url>"
pnpm ops:healthcheck:op -- "<rpc_url>" "<subgraph_url>"
```

## 上线前检查（建议）
1. `packages/contracts/deployments/<network>.json` 存在且包含：
   - `escrowFactory`
   - `disputeModule`
   - `complianceRegistry`
   - `dgpGovernor`
2. `pnpm subgraph:sync:arb && pnpm subgraph:build` 通过
3. `pnpm build` 通过
4. Web 与 Mini App `.env.local` 已由 `demo:prepare:*` 生成

## 回滚策略
- 合约是不可变部署，回滚采用“切换地址”策略。
- 如果新部署异常：
  1. 前端环境变量回退到上一版本地址
  2. Subgraph manifest 同步到旧地址并重建
  3. 暂停相关 UI 写操作入口
