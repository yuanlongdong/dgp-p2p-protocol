// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EscrowCore is ReentrancyGuard {
using SafeERC20 for IERC20;

enum Status { Created, Funded, Released, Refunded, Disputed, Ruled }

address public immutable buyer;
address public immutable seller;
IERC20 public immutable token;
uint256 public immutable amount;
uint64 public immutable timeoutAt;
address public disputeModule;
Status public status;
string public evidenceCID;

event Funded(address indexed from, uint256 amount);
event Released(address indexed to, uint256 amount);
event Refunded(address indexed to, uint256 amount);
event Disputed(string evidenceCID);
event Ruled(uint16 sellerBps, uint256 sellerAmount, uint256 buyerAmount);

modifier onlyBuyer() { require(msg.sender == buyer, "only-buyer"); _; }
modifier onlyDisputeModule() { require(msg.sender == disputeModule, "only-dispute-module"); _; }

constructor(
address _buyer,
address _seller,
address _token,
uint256 _amount,
uint64 _timeoutAt,
string memory _evidenceCID,
address _disputeModule
) {
buyer = _buyer;
seller = _seller;
token = IERC20(_token);
amount = _amount;
timeoutAt = _timeoutAt;
evidenceCID = _evidenceCID;
disputeModule = _disputeModule;
status = Status.Created;
}

function fund() external nonReentrant onlyBuyer {
require(status == Status.Created, "bad-status");
status = Status.Funded;
token.safeTransferFrom(msg.sender, address(this), amount);
emit Funded(msg.sender, amount);
}

function releaseToSeller() external nonReentrant onlyBuyer {
require(status == Status.Funded, "bad-status");
status = Status.Released;
token.safeTransfer(seller, amount);
emit Released(seller, amount);
}

function timeoutRefundToBuyer() external nonReentrant {
require(status == Status.Funded, "bad-status");
require(block.timestamp >= timeoutAt, "not-timeout");
status = Status.Refunded;
token.safeTransfer(buyer, amount);
emit Refunded(buyer, amount);
}

function markDispute(string calldata cid) external {
require(msg.sender == buyer || msg.sender == seller, "not-party");
require(status == Status.Funded, "bad-status");
status = Status.Disputed;
evidenceCID = cid;
emit Disputed(cid);
}

// sellerBps: 给卖家的比例（0~10000），其余给买家
function applyRuling(uint16 sellerBps) external nonReentrant onlyDisputeModule {
require(status == Status.Disputed, "not-disputed");
require(sellerBps <= 10000, "bad-bps");

status = Status.Ruled;
uint256 sellerAmount = (amount * sellerBps) / 10000;
uint256 buyerAmount = amount - sellerAmount;

if (sellerAmount > 0) token.safeTransfer(seller, sellerAmount);
if (buyerAmount > 0) token.safeTransfer(buyer, buyerAmount);

emit Ruled(sellerBps, sellerAmount, buyerAmount);
}
}
