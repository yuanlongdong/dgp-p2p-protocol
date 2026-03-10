// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GuarantorVault is Ownable {
using SafeERC20 for IERC20;

struct Position {
address guarantor;
IERC20 token;
uint256 amount;
bool active;
}

mapping(address => Position) public positions;
mapping(address => bool) public authorizedFactories;

event FactoryAuthorizationUpdated(address indexed factory, bool authorized);
event CollateralLocked(address indexed escrow, address indexed guarantor, address indexed token, uint256 amount);
event CollateralUnlocked(address indexed escrow, address indexed guarantor, address indexed token, uint256 amount);

modifier onlyFactory() {
require(authorizedFactories[msg.sender], "only-factory");
_;
}

constructor() Ownable(msg.sender) {}

function setFactoryAuthorization(address factory, bool authorized) external onlyOwner {
require(factory != address(0), "factory=0");
authorizedFactories[factory] = authorized;
emit FactoryAuthorizationUpdated(factory, authorized);
}

function hasActivePosition(address escrow) external view returns (bool) {
return positions[escrow].active;
}

function lockForEscrow(
address escrow,
address guarantor,
IERC20 token,
uint256 escrowAmount,
uint16 minCollateralBps
) external onlyFactory {
require(escrow != address(0), "escrow=0");
require(guarantor != address(0), "guarantor=0");
require(address(token) != address(0), "token=0");
require(escrowAmount > 0, "amount=0");
require(minCollateralBps >= 10000, "collateral<100%");

Position storage p = positions[escrow];
require(!p.active, "position-active");

uint256 collateral = (escrowAmount * minCollateralBps) / 10000;
require(collateral > 0, "collateral=0");

token.safeTransferFrom(guarantor, address(this), collateral);
positions[escrow] = Position({ guarantor: guarantor, token: token, amount: collateral, active: true });

emit CollateralLocked(escrow, guarantor, address(token), collateral);
}

function unlockForEscrow(address escrow) external onlyFactory {
Position storage p = positions[escrow];
require(p.active, "no-position");

address guarantor = p.guarantor;
IERC20 token = p.token;
uint256 amount = p.amount;

delete positions[escrow];
token.safeTransfer(guarantor, amount);

emit CollateralUnlocked(escrow, guarantor, address(token), amount);
}
}
