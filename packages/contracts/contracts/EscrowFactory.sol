// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./EscrowCore.sol";
import "./GuarantorVault.sol";

interface IComplianceRegistry {
function isAllowed(address account) external view returns (bool);
}

contract EscrowFactory is Ownable {
event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address escrow);
event CollateralConfigUpdated(address indexed vault, uint16 minCollateralBps);
event ComplianceConfigUpdated(address indexed registry, bool enforceCompliance);

uint256 public nextEscrowId;
mapping(uint256 => address) public escrows;
address public disputeModule;
address public guarantorVault;
uint16 public minCollateralBps = 15000;
address public complianceRegistry;
bool public enforceCompliance;

constructor(address _disputeModule) Ownable(msg.sender) {
disputeModule = _disputeModule;
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
require(seller != address(0), "seller=0");
require(amount > 0, "amount=0");
require(timeoutAt > block.timestamp, "bad-timeout");
_checkCompliance(buyer);
_checkCompliance(seller);

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
}
