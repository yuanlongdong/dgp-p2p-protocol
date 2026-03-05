// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MediatorRegistry is Ownable {
mapping(address => bool) private mediators;
mapping(address => bool) public isAdmin;
bool public paused;

event MediatorSet(address indexed mediator, bool allowed);
event AdminSet(address indexed account, bool allowed);
event Paused(address indexed by);
event Unpaused(address indexed by);

constructor(address initialOwner) Ownable(initialOwner) {
isAdmin[initialOwner] = true;
emit AdminSet(initialOwner, true);
}

modifier onlyAdmin() {
require(msg.sender == owner() || isAdmin[msg.sender], "not-admin");
_;
}

function setAdmin(address account, bool allowed) external onlyOwner {
isAdmin[account] = allowed;
emit AdminSet(account, allowed);
}

function pause() external onlyOwner {
paused = true;
emit Paused(msg.sender);
}

function unpause() external onlyOwner {
paused = false;
emit Unpaused(msg.sender);
}

function setMediator(address mediator, bool allowed) external onlyAdmin {
require(mediator != address(0), "mediator=0");
mediators[mediator] = allowed;
emit MediatorSet(mediator, allowed);
}

function isMediator(address mediator) external view returns (bool) {
if (paused) return false;
return mediators[mediator];
}
}
