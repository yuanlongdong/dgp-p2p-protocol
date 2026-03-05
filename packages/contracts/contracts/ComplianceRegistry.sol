// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceRegistry is Ownable {
mapping(address => bool) public isKycApproved;
mapping(address => bool) public isBlacklisted;
mapping(address => bool) public isAdmin;

event AdminSet(address indexed account, bool allowed);
event KycSet(address indexed account, bool approved);
event BlacklistSet(address indexed account, bool blacklisted);

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

function setKyc(address account, bool approved) external onlyAdmin {
require(account != address(0), "account=0");
isKycApproved[account] = approved;
emit KycSet(account, approved);
}

function setBlacklist(address account, bool blacklisted) external onlyAdmin {
require(account != address(0), "account=0");
isBlacklisted[account] = blacklisted;
emit BlacklistSet(account, blacklisted);
}

function isAllowed(address account) external view returns (bool) {
return isKycApproved[account] && !isBlacklisted[account];
}
}
