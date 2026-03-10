// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MediatorRegistry is Ownable, Pausable {
mapping(address => bool) private mediatorAllowed;
event MediatorSet(address indexed mediator, bool allowed);
event AdminSet(address indexed account, bool allowed);
event Paused(address indexed by);
event Unpaused(address indexed by);

constructor(address initialOwner) Ownable(initialOwner) {
isAdmin[initialOwner] = true;
emit AdminSet(initialOwner, true);
}

function setMediator(address mediator, bool allowed) external onlyOwner {
mediatorAllowed[mediator] = allowed;
emit MediatorSet(mediator, allowed);
}

function isMediator(address mediator) external view returns (bool) {
if (paused()) return false;
return mediatorAllowed[mediator];
}

function pause() external onlyOwner {
_pause();
}

function unpause() external onlyOwner {
_unpause();
}
}
