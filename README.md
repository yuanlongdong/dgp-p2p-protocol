# DGP-P2P

去中心化 P2P 担保系统（Escrow + Guarantor + Dispute + Telegram Mini App + Web + Subgraph）。

## 目标能力与模块规划

项目目标：**DGP P2P 托管系统**，面向“全量自动生成智能合约、Bot 功能、测试用例、审计报告和持续监控流程”的交付形态。

### 1. Arbitration Module

- 定义链上 dispute 数据结构：`disputeId`、投票记录、截止时间、买家/卖家身份。
- 提供仲裁投票函数，例如 `vote(disputeId, sellerBps)`。
- 根据仲裁结果联动托管释放 / 退款流程。
- 覆盖并发 dispute、投票超时、仲裁异常处理等测试场景。

### 2. Reputation System

- 定义信誉分模型：交易成功率、争议结果、押金量。
- 支持高信誉优先交易、低手续费，以及低信誉交易限制。
- 提供信誉更新逻辑，例如链上或链下 `updateReputation(userId)`。
- 在 Bot / MiniApp / Web 中实时展示信誉分。
- 覆盖极端刷单、争议失败等信誉测试场景。

### 3. Deposit & Risk Control

- 定义根据信誉动态调整的押金规则。
- 提供 `lockDeposit()`、`releaseDeposit()`、`slashDeposit()` 等能力。
- 覆盖押金不足、并发交易、仲裁失败扣罚等测试场景。

### 4. Smart Contract Security Audit

- 使用 Slither / Mythril / 自研静态分析扫描重入攻击、整数溢出、权限问题。
- 自动化模拟 `fundEscrow`、`releaseEscrow`、`dispute` 等攻击与异常路径。
- 生成安全审计报告、修复建议与最终优化方案。

### 5. Continuous Monitoring & AutoOps

- 监听 `EscrowCreated`、`EscrowFunded`、`DisputeCreated`、`EscrowReleased` 等链上事件。
- 自动报警异常交易、押金异常与仲裁风险。
- 执行每日 / 每周 AI 审计与优化建议输出。

### 6. Bot / MiniApp Integration

- 实现 `/deal`、`/pay`、`/release`、`/dispute`、`/status` 等用户入口。
- 自动绑定 `escrowId` 并与合约交互。
- 实时展示信誉分和押金状态。
- 覆盖 Bot 的极端和边界测试用例。

## 预期输出

- 智能合约
- 单元测试
- Bot 代码
- MiniApp 集成
- 审计报告
- 持续监控脚本

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
