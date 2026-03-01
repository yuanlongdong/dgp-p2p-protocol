# [Contracts] EscrowCore lifecycle hardening + guards

## Goal
强化 EscrowCore 生命周期与边界校验，避免异常状态转移和资金错误释放。

## Acceptance Criteria
- 非法状态调用均 revert
- 关键路径单测通过
