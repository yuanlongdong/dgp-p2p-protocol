# P2PTradeArbitration 持续监控与定期审计方案

本方案用于满足合约上线后的四类运营安全要求：实时监控、每周审计、审计报告生成、自动补丁推送。

## 1) 实时监控

- 脚本：`scripts/security/monitor-p2p-trade-arbitration.mjs`
- 输入：
  - `MONITOR_RPC_URL`：链上 RPC
  - `P2P_ARBITRATION_ADDRESS`：监控合约地址
  - `MONITOR_NETWORK`：网络名（如 `arb-mainnet`）
- 输出：
  - `docs/security/reports/runtime-monitoring/p2p-trade-arbitration.monitor.<network>.json`
  - `docs/security/reports/runtime-monitoring/p2p-trade-arbitration.monitor.<network>.md`
- 检测项：
  1. 失败交易数（回滚异常）
  2. 窗口期交易峰值（疑似攻击/异常流量）
  3. 原生币误转入（潜在误操作）

## 2) 定期审计（每周）

- 脚本：`scripts/security/weekly-audit-p2p-trade-arbitration.mjs`
- 执行内容：
  1. 运行静态分析：`analyze-p2p-trade-arbitration.mjs`
  2. 运行合约测试（针对 `P2PTradeArbitration`）
  3. 生成补丁建议：`generate-patch-proposal.mjs`
  4. 输出每周审计报告：`docs/security/reports/p2p-trade-arbitration.weekly-audit.md`
- 说明：若运行环境受限（如编译器下载被拦截），报告会标记 warning 并提示在内网 runner 复跑。

## 3) 审计报告生成

- 每周自动生成简洁报告，包含：
  - 漏洞概览（检查总数 / 发现总数）
  - 问题清单（含严重级别）
  - 修复建议与阻断发布建议
  - 安全与性能结论
- 运行命令：
  - `pnpm security:audit:weekly:p2p`

## 4) 自动生成补丁并推送开发

- 补丁建议脚本：`scripts/security/generate-patch-proposal.mjs`
- 输出：`docs/security/patches/p2p-trade-arbitration.auto-patch.md`
- CI 推送方式：
  - 在 `.github/workflows/contract-security-ops.yml` 中自动创建 GitHub Issue，派发给开发团队处理。
- 当前自动补丁覆盖：
  - `LOGIC-001`：到账差分入账 / 代币白名单策略
  - `LOGIC-002`：0 票结案治理策略（公平优先或可用性优先）
  - 运行时监控异常项的处置建议

## GitHub Actions 编排

新增工作流：`.github/workflows/contract-security-ops.yml`

- 近实时监控：每 15 分钟运行一次 `security:monitor:p2p`
- 周审计：每周一 UTC 02:00 运行 `security:audit:weekly:p2p`
- 产物上传：运行时监控报告、周审计报告、自动补丁建议
- 研发通知：自动创建 Security Patch Issue

## 本地执行示例

```bash
# 实时监控（单次）
MONITOR_RPC_URL=https://rpc.example.org \
P2P_ARBITRATION_ADDRESS=0x1234...abcd \
MONITOR_NETWORK=arb-mainnet \
pnpm security:monitor:p2p

# 每周审计（可手动触发）
pnpm security:audit:weekly:p2p

# 仅生成补丁建议
pnpm security:patch:proposal:p2p
```
