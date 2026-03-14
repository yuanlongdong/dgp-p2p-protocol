# #28 利益冲突修复说明（分支治理）

为解决「该分支存在必须解决的利益冲突」问题，本仓库已新增强制的职责分离检查（Separation of Duties）。

## 修复内容

1. 新增脚本：`scripts/security/conflict-of-interest-check.mjs`
   - 检查以下角色是否冲突：
     - 变更开发者（`SECURITY_CHANGE_AUTHOR` / `GITHUB_ACTOR`）
     - 安全复核人（`SECURITY_REVIEWER`）
     - 发布审批人（`SECURITY_APPROVER`）
   - 冲突规则：
     - 开发者 ≠ 复核人
     - 开发者 ≠ 审批人
     - 复核人 ≠ 审批人

2. 周审计脚本集成 COI 检查：
   - `scripts/security/weekly-audit-p2p-trade-arbitration.mjs` 在静态分析前执行 COI 检查。

3. CI 工作流集成 COI 检查：
   - `.github/workflows/contract-security-ops.yml` 的 `weekly-audit` job 增加 `Conflict-of-interest check` 步骤。
   - 默认 `COI_STRICT=1`，若未配置复核/审批角色会直接失败，避免带冲突发布。

4. 命令入口：
   - 新增 `pnpm security:coi:check`

## 配置要求（GitHub）

在仓库 Variables 中配置：
- `SECURITY_REVIEWER`
- `SECURITY_APPROVER`
- `COI_STRICT`（可选，默认 `1`）

## 验证示例

```bash
SECURITY_CHANGE_AUTHOR=alice \
SECURITY_REVIEWER=bob \
SECURITY_APPROVER=carol \
pnpm security:coi:check
```

若任意两个角色相同，命令将返回非 0 并输出“利益冲突”错误信息。
