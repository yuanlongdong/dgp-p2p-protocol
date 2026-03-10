// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./EscrowCore.sol";
import "./GuarantorVault.sol";

interface IComplianceRegistry {
function isAllowed(address account) external view returns (bool);
}

interface IOracleGuard {
function isPriceSafe(address token) external view returns (bool);
}

contract EscrowFactory is Ownable, Pausable {
event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address escrow);
event CollateralConfigUpdated(address indexed vault, uint16 minCollateralBps);
event ComplianceConfigUpdated(address indexed registry, bool enforceCompliance);
event RiskConfigUpdated(address indexed guard, bool enforceRiskGuard);
event MaxEscrowAmountUpdated(uint256 maxEscrowAmount);

uint256 public nextEscrowId;
mapping(uint256 => address) public escrows;
address public disputeModule;
address public guarantorVault;
uint16 public minCollateralBps = 15000;
address public complianceRegistry;
bool public enforceCompliance;
address public riskGuard;
bool public enforceRiskGuard;
uint256 public maxEscrowAmount = 500e18;

constructor(address _disputeModule) Ownable(msg.sender) {
disputeModule = _disputeModule;
}

function pause() external onlyOwner {
_pause();
}

function unpause() external onlyOwner {
_unpause();
}

function setCollateralConfig(address vault, uint16 minBps) external onlyOwner {
require(minBps >= 10000, "collateral<100%");
guarantorVault = vault;
minCollateralBps = minBps;
emit CollateralConfigUpdated(vault, minBps);
}

function setComplianceConfig(address registry, bool enforce) external onlyOwner {
complianceRegistry = registry;
enforceCompliance = enforce;
emit ComplianceConfigUpdated(registry, enforce);
}

function setRiskConfig(address guard, bool enforce) external onlyOwner {
riskGuard = guard;
enforceRiskGuard = enforce;
emit RiskConfigUpdated(guard, enforce);
}

function setMaxEscrowAmount(uint256 maxAmount) external onlyOwner {
require(maxAmount > 0, "max=0");
maxEscrowAmount = maxAmount;
emit MaxEscrowAmountUpdated(maxAmount);
}

function createEscrow(
address seller,
address token,
uint256 amount,
uint64 timeoutAt,
string calldata evidenceCID
) external returns (uint256 escrowId, address escrowAddr) {
return _createEscrow(msg.sender, seller, token, amount, timeoutAt, evidenceCID);
}

function createEscrowWithGuarantor(
address seller,
address token,
uint256 amount,
uint64 timeoutAt,
string calldata evidenceCID,
address guarantor
) external returns (uint256 escrowId, address escrowAddr) {
require(guarantor != address(0), "guarantor=0");
require(guarantorVault != address(0), "vault-not-set");
_checkCompliance(guarantor);

(escrowId, escrowAddr) = _createEscrow(msg.sender, seller, token, amount, timeoutAt, evidenceCID);
GuarantorVault(guarantorVault).lockForEscrow(
escrowAddr,
guarantor,
IERC20(token),
amount,
minCollateralBps
);
}

function releaseGuarantorCollateral(uint256 escrowId) external {
require(guarantorVault != address(0), "vault-not-set");
address escrowAddr = escrows[escrowId];
require(escrowAddr != address(0), "escrow-not-found");

EscrowCore.Status s = EscrowCore(escrowAddr).status();
require(
s == EscrowCore.Status.Released || s == EscrowCore.Status.Refunded || s == EscrowCore.Status.Ruled,
"escrow-active"
);

if (GuarantorVault(guarantorVault).hasActivePosition(escrowAddr)) {
GuarantorVault(guarantorVault).unlockForEscrow(escrowAddr);
}
}

function _createEscrow(
address buyer,
address seller,
address token,
uint256 amount,
uint64 timeoutAt,
string memory evidenceCID
) internal returns (uint256 escrowId, address escrowAddr) {
require(!paused(), "factory-paused");
require(seller != address(0), "seller=0");
require(amount > 0, "amount=0");
require(amount <= maxEscrowAmount, "amount too large");
require(timeoutAt > block.timestamp, "bad-timeout");
_checkCompliance(buyer);
_checkCompliance(seller);
_checkRisk(token);

escrowId = ++nextEscrowId;
EscrowCore escrow = new EscrowCore(buyer, seller, token, amount, timeoutAt, evidenceCID, disputeModule);
escrowAddr = address(escrow);
escrows[escrowId] = escrowAddr;
emit EscrowCreated(escrowId, buyer, seller, escrowAddr);
}

function _checkCompliance(address account) internal view {
if (!enforceCompliance) return;
require(complianceRegistry != address(0), "compliance-not-set");
require(IComplianceRegistry(complianceRegistry).isAllowed(account), "compliance-blocked");
}

function _checkRisk(address token) internal view {
if (!enforceRiskGuard) return;
require(riskGuard != address(0), "risk-not-set");
require(IOracleGuard(riskGuard).isPriceSafe(token), "risk-blocked");
}
}
