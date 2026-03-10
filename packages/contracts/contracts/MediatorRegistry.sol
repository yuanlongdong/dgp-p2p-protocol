// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MediatorRegistry is Ownable, Pausable {
    mapping(address => bool) private mediatorAllowed;
    mapping(address => bool) public isAdmin;

    event MediatorSet(address indexed mediator, bool allowed);
    event AdminSet(address indexed account, bool allowed);
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

    function setMediator(address mediator, bool allowed) external onlyAdmin {
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
