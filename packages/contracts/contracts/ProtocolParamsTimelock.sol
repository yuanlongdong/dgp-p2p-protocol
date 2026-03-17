// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ProtocolParamsTimelock is Ownable {
uint64 public immutable delaySeconds;

uint16 public buyerFeeBps;
uint16 public minCollateralBps;

struct PendingUint16 {
uint16 value;
uint64 executeAfter;
bool exists;
}

PendingUint16 public pendingBuyerFeeBps;
PendingUint16 public pendingMinCollateralBps;

event QueueBuyerFeeBps(uint16 value, uint64 executeAfter);
event ApplyBuyerFeeBps(uint16 value);
event QueueMinCollateralBps(uint16 value, uint64 executeAfter);
event ApplyMinCollateralBps(uint16 value);

constructor(address initialOwner, uint64 delaySeconds_, uint16 buyerFeeBps_, uint16 minCollateralBps_) Ownable(initialOwner) {
require(delaySeconds_ > 0, "delay=0");
require(buyerFeeBps_ <= 10000, "bad-fee");
require(minCollateralBps_ >= 10000, "bad-collateral");
delaySeconds = delaySeconds_;
buyerFeeBps = buyerFeeBps_;
minCollateralBps = minCollateralBps_;
}

function queueBuyerFeeBps(uint16 value) external onlyOwner {
require(value <= 10000, "bad-fee");
uint64 eta = uint64(block.timestamp) + delaySeconds;
pendingBuyerFeeBps = PendingUint16({ value: value, executeAfter: eta, exists: true });
emit QueueBuyerFeeBps(value, eta);
}

function applyBuyerFeeBps() external {
require(pendingBuyerFeeBps.exists, "no-pending");
require(block.timestamp >= pendingBuyerFeeBps.executeAfter, "timelock");
buyerFeeBps = pendingBuyerFeeBps.value;
delete pendingBuyerFeeBps;
emit ApplyBuyerFeeBps(buyerFeeBps);
}

function queueMinCollateralBps(uint16 value) external onlyOwner {
require(value >= 10000, "bad-collateral");
uint64 eta = uint64(block.timestamp) + delaySeconds;
pendingMinCollateralBps = PendingUint16({ value: value, executeAfter: eta, exists: true });
emit QueueMinCollateralBps(value, eta);
}

function applyMinCollateralBps() external {
require(pendingMinCollateralBps.exists, "no-pending");
require(block.timestamp >= pendingMinCollateralBps.executeAfter, "timelock");
minCollateralBps = pendingMinCollateralBps.value;
delete pendingMinCollateralBps;
emit ApplyMinCollateralBps(minCollateralBps);
}
}
