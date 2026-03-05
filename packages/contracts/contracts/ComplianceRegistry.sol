// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceRegistry is Ownable {
mapping(address => bool) public isKycApproved;
mapping(address => bool) public isBlacklisted;
mapping(address => bool) public isSanctioned;
mapping(address => uint16) public amlRiskScoreBps;
mapping(address => bool) public isAdmin;
bool public enforceAml;
uint16 public maxAmlRiskBps = 7000;

event AdminSet(address indexed account, bool allowed);
event KycSet(address indexed account, bool approved);
event BlacklistSet(address indexed account, bool blacklisted);
event SanctionSet(address indexed account, bool sanctioned);
event AmlRiskSet(address indexed account, uint16 riskBps);
event AmlConfigSet(bool enforce, uint16 maxRiskBps);

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

function setSanction(address account, bool sanctioned) external onlyAdmin {
require(account != address(0), "account=0");
isSanctioned[account] = sanctioned;
emit SanctionSet(account, sanctioned);
}

function setAmlRiskScore(address account, uint16 riskBps) external onlyAdmin {
require(account != address(0), "account=0");
require(riskBps <= 10000, "risk>100%");
amlRiskScoreBps[account] = riskBps;
emit AmlRiskSet(account, riskBps);
}

function setAmlConfig(bool enforce, uint16 maxRiskBps) external onlyOwner {
require(maxRiskBps <= 10000, "risk>100%");
enforceAml = enforce;
maxAmlRiskBps = maxRiskBps;
emit AmlConfigSet(enforce, maxRiskBps);
}

function isAllowed(address account) external view returns (bool) {
if (!isKycApproved[account] || isBlacklisted[account]) {
return false;
}
if (!enforceAml) {
return true;
}
return !isSanctioned[account] && amlRiskScoreBps[account] <= maxAmlRiskBps;
}
}
