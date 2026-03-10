// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPriceFeed {
uint8 public immutable decimals;
int256 public answer;
uint80 public roundId;
uint256 public updatedAt;

constructor(uint8 decimals_, int256 initialAnswer) {
decimals = decimals_;
answer = initialAnswer;
roundId = 1;
updatedAt = block.timestamp;
}

function setAnswer(int256 newAnswer) external {
answer = newAnswer;
roundId += 1;
updatedAt = block.timestamp;
}

function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
return (roundId, answer, updatedAt, updatedAt, roundId);
}
}
