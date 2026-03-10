// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAggregatorV3 {
function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
function decimals() external view returns (uint8);
}

contract OracleRouter is Ownable {
struct FeedConfig {
address feed;
uint32 maxAgeSeconds;
}

mapping(address => FeedConfig) public configOfToken;

event FeedSet(address indexed token, address indexed feed);
event FeedConfigSet(address indexed token, address indexed feed, uint32 maxAgeSeconds);

constructor(address initialOwner) Ownable(initialOwner) {}

function setFeed(address token, address feed) external onlyOwner {
setFeedConfig(token, feed, 0);
}

function setFeedConfig(address token, address feed, uint32 maxAgeSeconds) public onlyOwner {
require(token != address(0), "token=0");
require(feed != address(0), "feed=0");
configOfToken[token] = FeedConfig({ feed: feed, maxAgeSeconds: maxAgeSeconds });
emit FeedSet(token, feed);
emit FeedConfigSet(token, feed, maxAgeSeconds);
}

function latestPrice(address token) external view returns (uint256 price, uint8 decimals) {
FeedConfig memory cfg = configOfToken[token];
address feed = cfg.feed;
require(feed != address(0), "feed-not-set");
decimals = IAggregatorV3(feed).decimals();
(, int256 answer, , uint256 updatedAt, ) = IAggregatorV3(feed).latestRoundData();
require(answer > 0, "bad-price");
if (cfg.maxAgeSeconds > 0) {
require(updatedAt > 0, "bad-update-time");
require(block.timestamp - updatedAt <= cfg.maxAgeSeconds, "stale-price");
}
price = uint256(answer);
}
}
