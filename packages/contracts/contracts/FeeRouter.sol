// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FeeRouter is Ownable {
using SafeERC20 for IERC20;

uint16 public feeBps;
address public feeRecipient;

event FeeConfigUpdated(uint16 feeBps, address feeRecipient);
event FeeRouted(address indexed token, address indexed payer, address indexed seller, uint256 amount, uint256 feeAmount);

constructor(address initialOwner, address initialFeeRecipient, uint16 initialFeeBps) Ownable(initialOwner) {
require(initialFeeRecipient != address(0), "recipient=0");
require(initialFeeBps <= 10000, "bad-bps");
feeRecipient = initialFeeRecipient;
feeBps = initialFeeBps;
}

function setFeeConfig(address recipient, uint16 bps) external onlyOwner {
require(recipient != address(0), "recipient=0");
require(bps <= 10000, "bad-bps");
feeRecipient = recipient;
feeBps = bps;
emit FeeConfigUpdated(bps, recipient);
}

function preview(uint256 amount) public view returns (uint256 feeAmount, uint256 sellerAmount) {
feeAmount = (amount * feeBps) / 10000;
sellerAmount = amount - feeAmount;
}

function route(IERC20 token, address payer, address seller, uint256 amount) external returns (uint256 feeAmount, uint256 sellerAmount) {
require(address(token) != address(0), "token=0");
require(payer != address(0), "payer=0");
require(seller != address(0), "seller=0");
require(amount > 0, "amount=0");

(feeAmount, sellerAmount) = preview(amount);
token.safeTransferFrom(payer, address(this), amount);

if (feeAmount > 0) token.safeTransfer(feeRecipient, feeAmount);
if (sellerAmount > 0) token.safeTransfer(seller, sellerAmount);

emit FeeRouted(address(token), payer, seller, amount, feeAmount);
}
}
