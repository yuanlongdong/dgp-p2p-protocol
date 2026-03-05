# DGP-P2P 需求对照矩阵（截至当前分支）

状态定义：
- `已完成`：已有可运行实现与验证（测试/构建/CI）
- `部分完成`：有骨架或替代实现，但未达到目标级别
- `未完成`：尚未实现或仅文档占位

## 1. 核心功能模块

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| Escrow 合约（创建、锁定、释放、超时处理） | 已完成 | `packages/contracts/contracts/EscrowCore.sol` `packages/contracts/contracts/EscrowFactory.sol` `packages/contracts/test/escrow.spec.ts` | 无 |
| 担保合约（≥150% 超额抵押） | 已完成 | `packages/contracts/contracts/GuarantorVault.sol` `packages/contracts/test/collateral-flow.spec.ts` | 无 |
| 争议解决（证据、投票、分配） | 已完成 | `packages/contracts/contracts/DisputeModule.sol` `packages/contracts/test/dispute.spec.ts` | 无 |
| Kleros 仲裁接入 | 部分完成 | `packages/contracts/contracts/KlerosAdapterMock.sol` `packages/contracts/test/kleros-adapter.spec.ts` | 仍为 Mock，未接入 Kleros 主网/测试网真实合约 |

## 2. KYC/AML 模块

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| KYC 审核与黑名单 | 已完成 | `packages/contracts/contracts/ComplianceRegistry.sol` `packages/contracts/test/compliance.spec.ts` | 无 |
| AML 风险分、制裁名单、阈值开关 | 已完成 | `packages/contracts/contracts/ComplianceRegistry.sol` `packages/contracts/test/compliance.spec.ts` | 无 |
| 链下身份服务对接（第三方 KYC/AML Provider） | 未完成 | - | 未接入任何外部合规服务商 API |

## 3. Telegram Mini App

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| Mini App 基础接入与钱包交互 | 已完成 | `apps/miniapp/src/main.tsx` | 无 |
| Escrow 创建/资金操作/争议提交 | 已完成 | `apps/miniapp/src/main.tsx` | 无 |
| Telegram 内实时通知 | 部分完成 | 当前仅链上状态回显 | 未实现 bot 推送/订阅通知系统 |
| 中文 AI Bot 自助指导 | 未完成 | - | 尚无 bot 服务与会话编排实现 |

## 4. DAO 治理与经济模型

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| DGP Token（ERC-20） | 已完成 | `packages/contracts/contracts/DGPToken.sol` `packages/contracts/test/dgp-token.spec.ts` | 无 |
| 协议参数治理（投票/提案/执行） | 已完成 | `packages/contracts/contracts/DGPGovernorLite.sol` `packages/contracts/contracts/ProtocolParamsTimelock.sol` `packages/contracts/test/governor.spec.ts` | 无 |
| 手续费分配（担保人/调解员/保险/金库/回购销毁） | 已完成 | `packages/contracts/contracts/ProtocolTreasury.sol` `packages/contracts/test/protocol-treasury.spec.ts` | 无 |
| veDGP quorum、治理攻击完整防护模型 | 部分完成 | 有 timelock + quorum 基础 | 未实现 veDGP 锁仓治理权重 |

## 5. 安全与审计

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| 时间锁参数变更 | 已完成 | `packages/contracts/contracts/ProtocolParamsTimelock.sol` | 无 |
| TWAP/价格偏离风控 | 已完成 | `packages/contracts/contracts/OracleRouter.sol` `packages/contracts/contracts/OracleTwapGuard.sol` `packages/contracts/test/oracle-twap-guard.spec.ts` | 无 |
| 防闪电贷策略（完整） | 部分完成 | 已有 TWAP + 过期价格检查 | 未实现更完整的资金池级反操纵策略 |
| 多轮审计与漏洞赏金 | 未完成 | `docs/security-checklist.md`（流程占位） | 未执行第三方正式审计/赏金平台 |

## 6. 技术要求与集成

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| Arbitrum / Optimism 部署 | 已完成 | `packages/contracts/scripts/deploy.*.ts` `.github/workflows/deploy-sepolia-manual.yml` | 无 |
| The Graph 索引与查询 | 已完成 | `packages/subgraph/*` `apps/web/src/main.tsx` | 无 |
| IPFS 证据 CID 存储引用 | 已完成 | Escrow/Dispute 参数中 CID 字段 | 未提供官方上传网关服务 |
| Chainlink 预言机接入 | 部分完成 | `OracleRouter` 支持 Aggregator 接口 | 未配置真实 feed 地址与运行策略 |
| Kleros 集成 | 部分完成 | `KlerosAdapterMock` | 真实 Kleros court/桥接未落地 |

## 7. 工程化与交付能力

| 需求项 | 状态 | 代码证据 | 主要缺口 |
|---|---|---|---|
| 单元测试/集成测试 | 已完成 | `packages/contracts/test/*.spec.ts` | 无 |
| CI 构建与安全基线 | 已完成 | `.github/workflows/ci.yml` | 无 |
| 一键演示流水线 | 已完成 | `scripts/ops/e2e-demo.mjs` `scripts/ops/prepare-demo-env.mjs` | 无 |
| 生产可观测性（告警/监控看板） | 未完成 | - | 缺乏链上/服务监控体系 |

## 8. 结论

整体评估：`MVP 级主干已完成`，可在测试网演示完整交易闭环与治理闭环。  
距离“生产上线版”仍需补齐：
- 真实第三方集成（Kleros、Chainlink feed 配置、KYC/AML provider）
- 正式安全审计与漏洞赏金
- Telegram 实时通知与 AI Bot 服务
- 运营级监控与告警体系
