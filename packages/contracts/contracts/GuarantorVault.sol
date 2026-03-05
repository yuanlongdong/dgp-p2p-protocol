// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GuarantorVault is Ownable, ReentrancyGuard {
using SafeERC20 for IERC20;

mapping(address => mapping(address => uint256)) public balances;
mapping(address => bool) public isSlasher;

event SlasherSet(address indexed account, bool allowed);
event Deposited(address indexed guarantor, address indexed token, uint256 amount);
event Withdrawn(address indexed guarantor, address indexed token, uint256 amount);
event Slashed(address indexed guarantor, address indexed token, uint256 amount, address indexed to);

constructor(address initialOwner) Ownable(initialOwner) {}

modifier onlySlasher() {
require(msg.sender == owner() || isSlasher[msg.sender], "not-slasher");
_;
}

function setSlasher(address account, bool allowed) external onlyOwner {
isSlasher[account] = allowed;
emit SlasherSet(account, allowed);
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
require(bal >= amount, "insufficient");
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
require(bal >= amount, "insufficient");
balances[guarantor][address(token)] = bal - amount;
token.safeTransfer(to, amount);
emit Slashed(guarantor, address(token), amount, to);
}
}
