// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GuarantorVault is Ownable, ReentrancyGuard {
using SafeERC20 for IERC20;

mapping(address => mapping(address => uint256)) public balances;
mapping(address => mapping(address => uint256)) public lockedBalances;
mapping(address => bool) public isSlasher;
address public escrowFactory;

struct EscrowPosition {
address guarantor;
address token;
uint256 requiredCollateral;
bool active;
}

mapping(address => EscrowPosition) public escrowPositions;

event SlasherSet(address indexed account, bool allowed);
event EscrowFactorySet(address indexed escrowFactory);
event Deposited(address indexed guarantor, address indexed token, uint256 amount);
event Withdrawn(address indexed guarantor, address indexed token, uint256 amount);
event Slashed(address indexed guarantor, address indexed token, uint256 amount, address indexed to);
event CollateralLocked(address indexed escrow, address indexed guarantor, address indexed token, uint256 amount);
event CollateralUnlocked(address indexed escrow, address indexed guarantor, address indexed token, uint256 amount);
event EscrowSlashed(address indexed escrow, address indexed guarantor, address indexed token, uint256 amount, address to);

constructor(address initialOwner) Ownable(initialOwner) {}

modifier onlySlasher() {
require(msg.sender == owner() || isSlasher[msg.sender], "not-slasher");
_;
}

modifier onlyEscrowFactory() {
require(msg.sender == escrowFactory, "not-factory");
_;
}

function setSlasher(address account, bool allowed) external onlyOwner {
isSlasher[account] = allowed;
emit SlasherSet(account, allowed);
}

function setEscrowFactory(address account) external onlyOwner {
require(account != address(0), "factory=0");
escrowFactory = account;
emit EscrowFactorySet(account);
}

function deposit(IERC20 token, uint256 amount) external nonReentrant {
require(address(token) != address(0), "token=0");
require(amount > 0, "amount=0");
balances[msg.sender][address(token)] += amount;
token.safeTransferFrom(msg.sender, address(this), amount);
emit Deposited(msg.sender, address(token), amount);
}

function withdraw(IERC20 token, uint256 amount) external nonReentrant {
require(address(token) != address(0), "token=0");
require(amount > 0, "amount=0");
uint256 bal = balances[msg.sender][address(token)];
require(bal - lockedBalances[msg.sender][address(token)] >= amount, "insufficient");
balances[msg.sender][address(token)] = bal - amount;
token.safeTransfer(msg.sender, amount);
emit Withdrawn(msg.sender, address(token), amount);
}

function slash(address guarantor, IERC20 token, uint256 amount, address to) external nonReentrant onlySlasher {
require(guarantor != address(0), "guarantor=0");
require(address(token) != address(0), "token=0");
require(to != address(0), "to=0");
require(amount > 0, "amount=0");

uint256 bal = balances[guarantor][address(token)];
require(bal - lockedBalances[guarantor][address(token)] >= amount, "insufficient");
balances[guarantor][address(token)] = bal - amount;
token.safeTransfer(to, amount);
emit Slashed(guarantor, address(token), amount, to);
}

function lockForEscrow(
address escrow,
address guarantor,
IERC20 token,
uint256 escrowAmount,
uint16 collateralBps
) external onlyEscrowFactory returns (uint256 requiredCollateral) {
require(escrow != address(0), "escrow=0");
require(guarantor != address(0), "guarantor=0");
require(address(token) != address(0), "token=0");
require(escrowAmount > 0, "amount=0");
require(collateralBps >= 10000, "collateral<100%");
require(!escrowPositions[escrow].active, "position-exists");

requiredCollateral = (escrowAmount * collateralBps) / 10000;
uint256 available = balances[guarantor][address(token)] - lockedBalances[guarantor][address(token)];
require(available >= requiredCollateral, "insufficient-collateral");

lockedBalances[guarantor][address(token)] += requiredCollateral;
escrowPositions[escrow] = EscrowPosition({
guarantor: guarantor,
token: address(token),
requiredCollateral: requiredCollateral,
active: true
});

emit CollateralLocked(escrow, guarantor, address(token), requiredCollateral);
}

function unlockForEscrow(address escrow) external {
require(msg.sender == escrowFactory || msg.sender == owner(), "not-authorized");
EscrowPosition memory p = escrowPositions[escrow];
require(p.active, "no-position");
lockedBalances[p.guarantor][p.token] -= p.requiredCollateral;
delete escrowPositions[escrow];
emit CollateralUnlocked(escrow, p.guarantor, p.token, p.requiredCollateral);
}

function slashForEscrow(address escrow, uint256 amount, address to) external onlySlasher {
require(to != address(0), "to=0");
EscrowPosition memory p = escrowPositions[escrow];
require(p.active, "no-position");
require(amount > 0, "amount=0");
require(amount <= p.requiredCollateral, "exceed-collateral");

lockedBalances[p.guarantor][p.token] -= amount;
balances[p.guarantor][p.token] -= amount;
IERC20(p.token).safeTransfer(to, amount);
emit EscrowSlashed(escrow, p.guarantor, p.token, amount, to);

if (amount == p.requiredCollateral) {
delete escrowPositions[escrow];
} else {
escrowPositions[escrow].requiredCollateral = p.requiredCollateral - amount;
}
}

function hasActivePosition(address escrow) external view returns (bool) {
return escrowPositions[escrow].active;
}
}
