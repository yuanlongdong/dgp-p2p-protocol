// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./EscrowCore.sol";

contract EscrowFactory {
event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address escrow);

uint256 public nextEscrowId;
mapping(uint256 => address) public escrows;
address public disputeModule;

constructor(address _disputeModule) {
disputeModule = _disputeModule;
}

function createEscrow(
address seller,
address token,
uint256 amount,
uint64 timeoutAt,
string calldata evidenceCID
) external returns (uint256 escrowId, address escrowAddr) {
require(seller != address(0), "seller=0");
require(amount > 0, "amount=0");
require(timeoutAt > block.timestamp, "bad-timeout");

escrowId = ++nextEscrowId;
EscrowCore escrow = new EscrowCore(msg.sender, seller, token, amount, timeoutAt, evidenceCID, disputeModule);
escrowAddr = address(escrow);
escrows[escrowId] = escrowAddr;

emit EscrowCreated(escrowId, msg.sender, seller, escrowAddr);
}
}
