// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProtocolTreasury is Ownable {
using SafeERC20 for IERC20;

struct Split {
uint16 guarantorBps;
uint16 mediatorBps;
uint16 insuranceBps;
uint16 treasuryBps;
uint16 buybackBurnBps;
}

Split public split;
address public guarantorPool;
address public mediatorPool;
address public insuranceFund;
address public protocolTreasury;
address public buybackBurn;

event SplitUpdated(Split split);
event RecipientUpdated(string indexed bucket, address indexed recipient);
event FeesDistributed(address indexed token, uint256 amount);

constructor(
address initialOwner,
address guarantorPool_,
address mediatorPool_,
address insuranceFund_,
address protocolTreasury_,
address buybackBurn_
) Ownable(initialOwner) {
_setRecipients(guarantorPool_, mediatorPool_, insuranceFund_, protocolTreasury_, buybackBurn_);
split = Split({
guarantorBps: 5500,
mediatorBps: 1500,
insuranceBps: 1500,
treasuryBps: 1000,
buybackBurnBps: 500
});
}

function setRecipients(
address guarantorPool_,
address mediatorPool_,
address insuranceFund_,
address protocolTreasury_,
address buybackBurn_
) external onlyOwner {
_setRecipients(guarantorPool_, mediatorPool_, insuranceFund_, protocolTreasury_, buybackBurn_);
}

function setSplit(Split calldata newSplit) external onlyOwner {
require(
newSplit.guarantorBps +
newSplit.mediatorBps +
newSplit.insuranceBps +
newSplit.treasuryBps +
newSplit.buybackBurnBps == 10000,
"bad-split"
);
split = newSplit;
emit SplitUpdated(newSplit);
}

function distribute(IERC20 token, uint256 amount) external {
require(address(token) != address(0), "token=0");
require(amount > 0, "amount=0");

token.safeTransferFrom(msg.sender, address(this), amount);

uint256 guarantorAmt = (amount * split.guarantorBps) / 10000;
uint256 mediatorAmt = (amount * split.mediatorBps) / 10000;
uint256 insuranceAmt = (amount * split.insuranceBps) / 10000;
uint256 treasuryAmt = (amount * split.treasuryBps) / 10000;
uint256 buybackAmt = amount - guarantorAmt - mediatorAmt - insuranceAmt - treasuryAmt;

if (guarantorAmt > 0) token.safeTransfer(guarantorPool, guarantorAmt);
if (mediatorAmt > 0) token.safeTransfer(mediatorPool, mediatorAmt);
if (insuranceAmt > 0) token.safeTransfer(insuranceFund, insuranceAmt);
if (treasuryAmt > 0) token.safeTransfer(protocolTreasury, treasuryAmt);
if (buybackAmt > 0) token.safeTransfer(buybackBurn, buybackAmt);

emit FeesDistributed(address(token), amount);
}

function _setRecipients(
address guarantorPool_,
address mediatorPool_,
address insuranceFund_,
address protocolTreasury_,
address buybackBurn_
) internal {
require(guarantorPool_ != address(0), "guarantor=0");
require(mediatorPool_ != address(0), "mediator=0");
require(insuranceFund_ != address(0), "insurance=0");
require(protocolTreasury_ != address(0), "treasury=0");
require(buybackBurn_ != address(0), "buyback=0");
guarantorPool = guarantorPool_;
mediatorPool = mediatorPool_;
insuranceFund = insuranceFund_;
protocolTreasury = protocolTreasury_;
buybackBurn = buybackBurn_;
emit RecipientUpdated("guarantor", guarantorPool_);
emit RecipientUpdated("mediator", mediatorPool_);
emit RecipientUpdated("insurance", insuranceFund_);
emit RecipientUpdated("treasury", protocolTreasury_);
emit RecipientUpdated("buyback", buybackBurn_);
}
}
