# DGP-P2P

去中心化 P2P 担保系统（Escrow + Guarantor + Dispute + Telegram Mini App + Web + Subgraph）。

## 项目组成

- `apps/web`：面向桌面浏览器的钱包/合约控制台。
- `apps/miniapp`：Telegram Mini App 页面。
- `apps/telegram-bot`：Telegram Bot 命令与消息模板。
- `packages/contracts`：Hardhat 合约工程与测试。
- `packages/subgraph`：链上事件索引与查询层。
- `scripts/ops`、`scripts/security`：运维、健康检查与安全脚本。

## 环境要求

- Node.js 22
- `pnpm@9.0.0`（项目通过 Corepack 管理）

推荐初始化方式：

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install
```

## 常用本地命令

### 整体验证

```bash
pnpm build
pnpm test:contracts
pnpm ops:takeover:check
pnpm security:baseline
```

### 前端 / Bot 开发

```bash
pnpm dev:web
pnpm dev:miniapp
pnpm dev:bot
```

### 合约相关

```bash
pnpm --filter @dgp/contracts build
pnpm --filter @dgp/contracts test
pnpm --filter @dgp/contracts deploy:arb-sepolia
pnpm --filter @dgp/contracts deploy:op-sepolia
```

### Subgraph

```bash
pnpm subgraph:codegen
pnpm subgraph:build
pnpm subgraph:sync:arb
pnpm subgraph:sync:op
```

### 运维 / Demo

```bash
pnpm ops:healthcheck:arb
pnpm ops:healthcheck:op
pnpm demo:prepare:arb
pnpm demo:prepare:op
pnpm demo:e2e:arb
pnpm demo:e2e:op
```

## CI 说明

- `ci.yml` 会执行 `pnpm ops:takeover:check`，覆盖全仓构建与合约测试。
- `slither.yml` 会先安装依赖、预编译 `@dgp/contracts`，再运行 Slither 静态分析。
- `packages/contracts` 当前使用 Hardhat + Solidity `0.8.24` 配置；本地如果无法下载编译器，请优先检查网络 / 代理设置。

## 备注

如果你只想快速确认仓库当前是否可接管，直接运行：

```bash
pnpm install
pnpm ops:takeover:check
```
