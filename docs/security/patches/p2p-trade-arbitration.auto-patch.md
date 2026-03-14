# P2PTradeArbitration 自动补丁建议

- 生成时间: 2026-03-14T03:19:41.693Z
- 来源: 静态分析 + 运行时监控

## 待修复项

### LOGIC-001: Fee-on-transfer 兼容修复
- 在 `fundTrade` 中增加前后余额差分：`received = after - before`。
- 将托管金额改为 `received`，避免按名义金额结算导致余额不足。
- 事件新增 `quotedAmount` 与 `receivedAmount` 字段。
- 同步补充 fee-on-transfer 单测覆盖。

### LOGIC-002: 0票结案策略定版
- 方案A（公平优先）: 在 fallback 前增加 `require(totalVotes > 0, "no-votes")`。
- 方案B（可用性优先）: 保留自动退款但新增 `DisputeAutoResolvedNoVotes` 事件并接入告警。
- 根据治理策略二选一并补齐测试。

## 推送给开发人员
- CI 可将本文件作为 artifact 上传，并通过 Issue/PR comment 自动分发给开发负责人。
- 建议将高危与中危项设为阻断发布条件。

