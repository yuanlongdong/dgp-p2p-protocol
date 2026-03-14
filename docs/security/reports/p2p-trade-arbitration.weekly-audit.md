# 每周安全审计报告（自动生成）

- 生成时间: 2026-03-14T03:19:41.708Z
- 合约: `P2PTradeArbitration.sol`

## 漏洞总结
- 静态分析检查项: n/a，发现问题: n/a
- [medium] LOGIC-001: Fee-on-transfer / deflationary token incompatibility risk
- [low] LOGIC-002: Dispute can resolve with zero votes via fallback branch

## 修复建议
- 自动补丁建议文件: `docs/security/patches/p2p-trade-arbitration.auto-patch.md` (已生成)
- 对 Medium 及以上问题应在当周排期并提交修复 PR。

## 安全性评估
- 本周测试受环境限制（编译器下载/网络限制），请在内网 runner 复跑并补传证据。

## 性能评估
- 当前流程未检测到明显复杂度退化；建议持续记录 gas 基线并监控周环比变化。

## 执行日志
- [PASS] node scripts/security/analyze-p2p-trade-arbitration.mjs
- [FAIL] pnpm --filter @dgp/contracts test -- --grep P2PTradeArbitration
- [PASS] node scripts/security/generate-patch-proposal.mjs
