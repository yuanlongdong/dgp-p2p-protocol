# Outsourcing Brief - DGP-P2P

## 项目目标
构建去中心化 P2P 担保系统（Arbitrum/Optimism），含托管、担保、争议仲裁、前端与 Telegram Mini App。

## 技术栈
- Contracts: Solidity + Hardhat
- Web: React + Vite + wagmi + viem
- Mini App: React + Telegram WebApp SDK
- Indexing: The Graph
- Storage: IPFS

## 供应商接手优先级
P1 (2周):
- 合约测试补全（happy path + revert + edge）
- 部署脚本和网络配置标准化
- Web 真链交互稳定化（交易状态、错误处理）

P2 (2-4周):
- Dispute 流程完善（多轮投票、超时、执行保护）
- MiniApp 打通钱包与核心操作
- Subgraph 联调与历史页

P3 (4周+):
- Kleros adapter
- DAO 参数治理（timelock + proposal）
- 安全审计修复与监控告警

## 验收标准
- 测试网完整演示闭环
- 合约单测覆盖关键路径
- 前端可执行核心交易与状态查询
- 文档齐全（部署、回滚、应急）
