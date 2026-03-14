# 智能合约开发与审计一体化工作流（P2PTradeArbitration）

本工作流对应以下 6 个阶段：
1) 需求文档；2) 合约代码；3) 静态分析；4) 攻击模拟；5) 审计报告；6) 持续监控与定期审计。

## 一键执行（推荐）

```bash
pnpm security:workflow:p2p
```

该命令会执行：
- 校验需求文档、合约代码、测试文件是否存在；
- 运行静态分析脚本；
- 运行攻击模拟测试（环境受限时会保留失败信息并继续生成报告）；
- 生成审计摘要报告；
- 触发每周审计脚本（包含补丁建议生成）。

---

## 阶段 1：合约需求文档生成

- 文档：`docs/smart-contract-requirements.zh-CN.md`
- 覆盖模块：仲裁模块、信誉评分系统、交易管理、安全性要求。

## 阶段 2：合约代码生成

- 主合约：`packages/contracts/contracts/P2PTradeArbitration.sol`
- 攻击模拟辅助合约：`packages/contracts/contracts/ReentrantMockERC20.sol`
- 测试：
  - `packages/contracts/test/p2p-trade-arbitration.spec.ts`
  - `packages/contracts/test/p2p-trade-arbitration.attack.spec.ts`

## 阶段 3：静态分析与漏洞检测

- 命令：

```bash
node scripts/security/analyze-p2p-trade-arbitration.mjs
```

- 产物：
  - `docs/security/reports/p2p-trade-arbitration.static-analysis.json`
  - `docs/security/reports/p2p-trade-arbitration.static-analysis.md`

## 阶段 4：攻击模拟与防护验证

- 命令：

```bash
pnpm --filter @dgp/contracts test -- --grep "attack simulations"
```

- 关注点：重入、DoS 高压、边界条件、恶意调用。

## 阶段 5：生成审计报告

- 审计摘要命令：

```bash
pnpm security:audit:summary:p2p
```

- 产物：`docs/security/reports/p2p-trade-arbitration.audit-summary.md`
- 每周报告：`docs/security/reports/p2p-trade-arbitration.weekly-audit.md`
- 自动补丁建议：`docs/security/patches/p2p-trade-arbitration.auto-patch.md`

## 阶段 6：持续审计与监控

- 实时监控（脚本）：`scripts/security/monitor-p2p-trade-arbitration.mjs`
- 每周审计（脚本）：`scripts/security/weekly-audit-p2p-trade-arbitration.mjs`
- CI 调度：`.github/workflows/contract-security-ops.yml`
  - 每 15 分钟运行运行时监控
  - 每周一 UTC 02:00 执行审计与补丁建议
  - 自动上传报告并创建开发修复 Issue
