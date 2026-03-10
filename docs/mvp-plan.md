# MVP 执行计划（Execution Plan）

> 目标：把 DGP-P2P 从“功能具备”推进到“可演示、可验收、可交付”。

## 1. MVP 范围与结果

MVP 关闭时需要同时满足以下结果：

- 合约主流程可跑通：创建托管、注资、放款、退款、争议处理。
- 双入口可用：Web + Telegram Mini App/Bot 均可完成核心操作。
- 可追溯：Subgraph 可稳定索引并支持历史查询。
- 可运维：健康检查、演示脚本、性能与安全证据可复现。

## 2. 工作流拆分（按责任域）

### A. 合约与协议层

**工作内容**

- 托管生命周期：create/fund/release/refund。
- 争议闭环：open dispute、证据 CID、投票/法定人数、超时结算。
- 安全加固与测试网部署脚本。

**完成标准（DoD）**

- 单测 + 集成测试覆盖主路径与恶意路径。
- Sepolia 目标链部署脚本可重复执行。
- 关键风险项（权限、重入、超时边界）有对应测试或防护。

### B. Web 与 Mini App 交互层

**工作内容**

- 钱包连接与链守卫（chain guard）。
- 创建托管表单校验。
- 发起争议、查询投票/结果。
- Telegram 指令与 Mini App 核心操作串联。

**完成标准（DoD）**

- 从空环境到完成一次托管流程可复现。
- 链错误、参数错误、合约错误均有可见提示。
- 前端状态与合约事件字段保持一致。

### C. 数据与观测层

**工作内容**

- Subgraph schema/mapping/indexing。
- 历史查询与争议时间线查询。
- 性能基线场景与阈值维护。

**完成标准（DoD）**

- 从部署块开始稳定索引，不出现结构性漏数。
- Web/Mini App 使用的查询语句有文档化样例。
- 性能脚本结果可在 CI/本地重复产出。

### D. 运维与上线准备

**工作内容**

- preprod runbook、闭环检查清单。
- secrets matrix 与 deploy signoff 证据。
- 审计/赏金/主网前置材料准备。

**完成标准（DoD）**

- 每次版本发布均有命令、输出、证据路径。
- 未完成项均有 owner + 截止日期。
- 发布阻断项（blockers）被显式列出。

## 3. 与现有 issue 文档映射（执行入口）

按 `docs/issues/*.md` 作为执行单元，建议优先级如下：

1. `01-contracts-escrow-hardening.md`
2. `02-contracts-dispute-timeout-quorum.md`
3. `03-contracts-deploy-scripts-sepolia.md`
4. `04-web-wallet-chain-guard.md`
5. `05-web-create-escrow-validation.md`
6. `06-web-dispute-open-vote-query.md`
7. `07-miniapp-telegram-sdk-bootstrap.md`
8. `08-miniapp-escrow-actions.md`
9. `09-subgraph-setup-indexing.md`
10. `10-ci-security-baseline.md`

## 4. 6 周节奏（建议）

### 第 1 周：协议稳定

- 关闭合约加固与争议参数边界。
- 冻结对前端/索引器暴露的事件字段。

### 第 2 周：部署与索引启动

- 打通测试网部署脚本。
- 完成 Subgraph 首次索引与回放验证。

### 第 3 周：Web 主路径

- 完成钱包守卫 + 创建托管校验。
- 接入争议发起与投票查询。

### 第 4 周：Mini App 主路径

- 完成 Telegram SDK 接入。
- 打通 Mini App 托管核心动作。

### 第 5 周：性能与安全证据

- 跑压测场景并与阈值比对。
- 补全安全 runbook 与证据链接。

### 第 6 周：RC 与交付收口

- 双链端到端演示跑通。
- 产出 closure 报告与已知风险清单。

## 5. 验收命令（最小集合）

按交付阶段至少执行：

```bash
pnpm ops:takeover:check
pnpm perf:contracts
node scripts/econ/apy-sim.mjs
pnpm demo:e2e:arb
pnpm demo:e2e:op
```

并检查以下产物是否更新：

- `docs/perf/results/latest.md`
- `docs/econ/results/latest.md`
- `docs/status/` 下最新 closure 文档

## 6. MVP 退出标准（Exit Criteria）

仅当以下条件全部满足，MVP 才可宣布完成：

1. 合约 + Web + Mini App + Subgraph 完成端到端可演示闭环。
2. 性能与经济模型产物可重复生成，且结果在阈值内。
3. 安全与运维清单全部具备证据链接（非占位文本）。
4. 非 MVP 事项（审计执行、赏金启动、主网凭据）具备 owner 与时间表。
