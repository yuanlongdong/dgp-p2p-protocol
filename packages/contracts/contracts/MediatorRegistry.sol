// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MediatorRegistry is Ownable {
mapping(address => bool) public isMediator;
event MediatorSet(address indexed mediator, bool allowed);

constructor(address initialOwner) Ownable(initialOwner) {}

function setMediator(address mediator, bool allowed) external onlyOwner {
isMediator[mediator] = allowed;
emit MediatorSet(mediator, allowed);
}
}
