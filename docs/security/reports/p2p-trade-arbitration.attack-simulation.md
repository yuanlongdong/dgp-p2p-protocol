# P2PTradeArbitration 自动化攻击模拟报告

## 范围

- 目标合约：`packages/contracts/contracts/P2PTradeArbitration.sol`
- 攻击脚本：`packages/contracts/test/p2p-trade-arbitration.attack.spec.ts`
- 恶意辅助合约：`packages/contracts/contracts/ReentrantMockERC20.sol`

## 攻击场景与评估

## 1. 重入攻击模拟

- **脚本场景**：恶意 ERC20 在 `transfer/transferFrom` 中回调 `releaseTrade`，尝试重入二次放款。
- **验证点**：
  - `nonReentrant` 是否阻断重入路径。
  - 状态是否只迁移一次（`Funded -> Released`）。
  - 卖家余额是否仅收到一次资金。
- **评估**：当前设计（`nonReentrant + 状态先更新`）可有效降低重入风险。
- **建议**：
  1. 保留 `nonReentrant` 于所有涉及转账的外部函数。
  2. 增加 `hook` 类恶意代币回归测试，防止重构退化。

## 2. 拒绝服务（DoS）/高请求压测模拟

- **脚本场景**：连续执行 30 轮 `create -> fund -> dispute -> vote -> resolve`。
- **验证点**：
  - 多轮高频请求下核心流程不出现状态卡死。
  - 交易编号和信誉更新保持一致性。
- **评估**：顺序高负载下，核心状态机可持续推进。
- **建议**：
  1. 在 CI 增加 gas 快照与阈值告警。
  2. 在主网前增加更高轮次 fuzz/load 测试（例如 100~500 轮）。

## 3. 边界条件测试

- **脚本场景**：
  - `amount=0` 创建交易。
  - `minVotesToResolve=0` 参数配置。
  - 余额/授权不足时 `fundTrade`。
- **验证点**：非法参数是否被正确回滚。
- **评估**：关键边界已具备参数校验。
- **建议**：补充极大数值（`type(uint256).max`）与时间边界（`deadline == block.timestamp`）测试。

## 4. 恶意调用模拟

- **脚本场景**：非 owner、非买家、非交易参与方、非仲裁员分别调用敏感函数。
- **验证点**：权限保护是否生效。
- **评估**：访问控制路径总体有效。
- **建议**：
  1. 将 owner 迁移到多签 + timelock。
  2. 对治理参数变更接入监控告警。

---

## 发现与修改建议（自动化模拟后）

1. **代币兼容性风险（中危）**
   - 使用 fee-on-transfer 代币时，可能因到账不足导致结算期失败。
   - **建议修复**：
     - 在 `fundTrade` 使用前后余额差校验实际到账；或
     - 引入白名单仅允许标准 ERC20。

2. **争议 0 票结案策略（低危/策略型）**
   - 在 `minVotesToResolve` 机制下可出现超时 0 票退款。
   - **建议修复**：
     - 若业务要求最小参与，增加 `require(totalVotes > 0)`；
     - 或明确写入产品规则并增加事件告警。

## 总体安全结论

- 在当前模拟覆盖下，**重入、权限越权、基础边界输入**防护表现较好。
- 建议在主网上线前补齐：
  - fee-on-transfer 兼容处理；
  - 0 票争议结案策略确认；
  - 更高强度负载与 fuzz 测试。
