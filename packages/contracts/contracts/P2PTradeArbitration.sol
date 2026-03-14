// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title P2PTradeArbitration
 * @notice Implements trade escrow management, dispute arbitration, and reputation scoring in one contract.
 * @dev This contract follows CEI pattern, uses SafeERC20 for token interactions, and ReentrancyGuard for value flows.
 */
contract P2PTradeArbitration is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Trade lifecycle states.
    enum TradeStatus {
        Pending,
        Funded,
        Released,
        Refunded,
        Disputed,
        Arbitrated
    }

    /// @notice Arbitration final outcome.
    enum ArbitrationOutcome {
        None,
        BuyerWin,
        SellerWin,
        Tie
    }

    /// @notice Core trade information.
    struct Trade {
        uint256 id;
        address buyer;
        address seller;
        uint256 amount;
        uint64 deadline;
        TradeStatus status;
        bool exists;
    }

    /// @notice Per-trade dispute details.
    struct Dispute {
        uint64 voteEnd;
        uint32 votesForBuyer;
        uint32 votesForSeller;
        bool resolved;
        ArbitrationOutcome outcome;
    }

    /// @notice Shared score constants for reputation updates.
    uint256 public constant DEFAULT_REPUTATION = 500;
    uint256 public constant MIN_REPUTATION = 0;
    uint256 public constant MAX_REPUTATION = 1000;

    uint256 public releaseReward = 10;
    uint256 public disputeWinReward = 5;
    uint256 public disputeLossPenalty = 8;
    uint256 public disputeOpenPenalty = 2;

    uint64 public voteDuration = 3 days;

    IERC20 public immutable settlementToken;
    uint256 public nextTradeId;

    mapping(uint256 => Trade) public trades;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public isArbitrator;

    event TradeCreated(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline);
    event TradeFunded(uint256 indexed tradeId, address indexed buyer, uint256 amount);
    event TradeReleased(uint256 indexed tradeId, address indexed seller, uint256 amount);
    event TradeRefunded(uint256 indexed tradeId, address indexed buyer, uint256 amount);
    event DisputeOpened(uint256 indexed tradeId, uint64 voteEnd);
    event VoteCast(uint256 indexed tradeId, address indexed arbitrator, bool supportBuyer);
    event DisputeResolved(uint256 indexed tradeId, ArbitrationOutcome outcome, uint256 buyerAmount, uint256 sellerAmount);
    event ArbitratorUpdated(address indexed arbitrator, bool enabled);
    event ReputationUpdated(address indexed user, uint256 oldScore, uint256 newScore);

    /**
     * @notice Initializes the contract with the ERC20 token used for escrow settlement.
     * @param token Address of the ERC20 token used to fund and settle trades.
     */
    constructor(address token) Ownable(msg.sender) {
        require(token != address(0), "token=0");
        settlementToken = IERC20(token);
    }

    /**
     * @notice Pauses state-changing operations.
     * @dev Only owner can pause in case of emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses state-changing operations.
     * @dev Only owner can resume after mitigation.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configures whether an account can arbitrate disputes.
     * @param arbitrator Address to enable or disable as arbitrator.
     * @param enabled True to authorize, false to revoke.
     */
    function setArbitrator(address arbitrator, bool enabled) external onlyOwner {
        require(arbitrator != address(0), "arbitrator=0");
        isArbitrator[arbitrator] = enabled;
        emit ArbitratorUpdated(arbitrator, enabled);
    }

    /**
     * @notice Updates arbitration vote window duration.
     * @param newDuration New vote duration in seconds.
     */
    function setVoteDuration(uint64 newDuration) external onlyOwner {
        require(newDuration > 0, "duration=0");
        voteDuration = newDuration;
    }

    /**
     * @notice Creates a new trade record in Pending status.
     * @param seller Seller address that will receive funds when trade is released.
     * @param amount Escrow amount denominated in settlement token.
     * @param deadline Timestamp used for timeout-based refunds.
     * @return tradeId Newly created trade ID.
     */
    function createTrade(address seller, uint256 amount, uint64 deadline) external whenNotPaused returns (uint256 tradeId) {
        require(seller != address(0), "seller=0");
        require(seller != msg.sender, "same-party");
        require(amount > 0, "amount=0");
        require(deadline > block.timestamp, "bad-deadline");

        tradeId = ++nextTradeId;
        trades[tradeId] = Trade({
            id: tradeId,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            deadline: deadline,
            status: TradeStatus.Pending,
            exists: true
        });

        emit TradeCreated(tradeId, msg.sender, seller, amount, deadline);
    }

    /**
     * @notice Deposits buyer funds into escrow and moves trade to Funded.
     * @param tradeId ID of trade being funded.
     */
    function fundTrade(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer, "only-buyer");
        require(trade.status == TradeStatus.Pending, "bad-status");

        trade.status = TradeStatus.Funded;
        settlementToken.safeTransferFrom(msg.sender, address(this), trade.amount);

        emit TradeFunded(tradeId, msg.sender, trade.amount);
    }

    /**
     * @notice Releases escrowed funds to seller after successful fulfillment.
     * @param tradeId ID of trade to release.
     */
    function releaseTrade(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer, "only-buyer");
        require(trade.status == TradeStatus.Funded, "bad-status");

        trade.status = TradeStatus.Released;
        settlementToken.safeTransfer(trade.seller, trade.amount);
        _applyReleaseReputationUpdate(trade.buyer, trade.seller);

        emit TradeReleased(tradeId, trade.seller, trade.amount);
    }

    /**
     * @notice Refunds escrowed funds to buyer when trade deadline has expired.
     * @param tradeId ID of trade to refund.
     */
    function refundAfterDeadline(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        require(trade.status == TradeStatus.Funded, "bad-status");
        require(block.timestamp >= trade.deadline, "not-expired");

        trade.status = TradeStatus.Refunded;
        settlementToken.safeTransfer(trade.buyer, trade.amount);
        _applyDelta(trade.seller, -int256(disputeLossPenalty));

        emit TradeRefunded(tradeId, trade.buyer, trade.amount);
    }

    /**
     * @notice Opens dispute voting for a funded trade.
     * @param tradeId ID of trade entering dispute process.
     */
    function openDispute(uint256 tradeId) external whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer || msg.sender == trade.seller, "not-party");
        require(trade.status == TradeStatus.Funded, "bad-status");

        trade.status = TradeStatus.Disputed;
        disputes[tradeId] = Dispute({
            voteEnd: uint64(block.timestamp) + voteDuration,
            votesForBuyer: 0,
            votesForSeller: 0,
            resolved: false,
            outcome: ArbitrationOutcome.None
        });

        _applyDelta(msg.sender, -int256(disputeOpenPenalty));
        emit DisputeOpened(tradeId, disputes[tradeId].voteEnd);
    }

    /**
     * @notice Records a dispute vote from an authorized arbitrator.
     * @param tradeId ID of disputed trade.
     * @param supportBuyer True to vote for buyer; false to vote for seller.
     */
    function castVote(uint256 tradeId, bool supportBuyer) external whenNotPaused {
        require(isArbitrator[msg.sender], "not-arbitrator");

        Trade storage trade = _getTrade(tradeId);
        require(trade.status == TradeStatus.Disputed, "not-disputed");

        Dispute storage dispute = disputes[tradeId];
        require(!dispute.resolved, "resolved");
        require(block.timestamp <= dispute.voteEnd, "vote-closed");
        require(!hasVoted[tradeId][msg.sender], "already-voted");

        hasVoted[tradeId][msg.sender] = true;
        if (supportBuyer) {
            dispute.votesForBuyer += 1;
        } else {
            dispute.votesForSeller += 1;
        }

        emit VoteCast(tradeId, msg.sender, supportBuyer);
    }

    /**
     * @notice Finalizes dispute result and applies fund distribution and reputation updates.
     * @param tradeId ID of disputed trade to resolve.
     * @return outcome Final arbitration outcome.
     * @return buyerAmount Amount sent to buyer.
     * @return sellerAmount Amount sent to seller.
     */
    function resolveDispute(uint256 tradeId)
        external
        nonReentrant
        whenNotPaused
        returns (ArbitrationOutcome outcome, uint256 buyerAmount, uint256 sellerAmount)
    {
        Trade storage trade = _getTrade(tradeId);
        require(trade.status == TradeStatus.Disputed, "not-disputed");

        Dispute storage dispute = disputes[tradeId];
        require(!dispute.resolved, "resolved");
        require(block.timestamp > dispute.voteEnd, "vote-active");
        require(dispute.votesForBuyer + dispute.votesForSeller > 0, "no-votes");

        dispute.resolved = true;
        trade.status = TradeStatus.Arbitrated;

        if (dispute.votesForBuyer > dispute.votesForSeller) {
            outcome = ArbitrationOutcome.BuyerWin;
            buyerAmount = trade.amount;
            dispute.outcome = outcome;
            settlementToken.safeTransfer(trade.buyer, buyerAmount);
            _applyDisputeOutcomeReputation(trade.buyer, trade.seller, true);
        } else if (dispute.votesForSeller > dispute.votesForBuyer) {
            outcome = ArbitrationOutcome.SellerWin;
            sellerAmount = trade.amount;
            dispute.outcome = outcome;
            settlementToken.safeTransfer(trade.seller, sellerAmount);
            _applyDisputeOutcomeReputation(trade.seller, trade.buyer, true);
        } else {
            outcome = ArbitrationOutcome.Tie;
            buyerAmount = trade.amount;
            dispute.outcome = outcome;
            settlementToken.safeTransfer(trade.buyer, buyerAmount);
            _applyDisputeOutcomeReputation(trade.buyer, trade.seller, false);
        }

        emit DisputeResolved(tradeId, outcome, buyerAmount, sellerAmount);
    }

    /**
     * @notice Returns trade details by ID.
     * @param tradeId ID of queried trade.
     * @return trade Full trade struct for the provided ID.
     */
    function getTrade(uint256 tradeId) external view returns (Trade memory trade) {
        trade = _getTrade(tradeId);
    }

    /**
     * @notice Returns dispute details by trade ID.
     * @param tradeId ID of queried disputed trade.
     * @return dispute Full dispute struct for the provided trade.
     */
    function getDispute(uint256 tradeId) external view returns (Dispute memory dispute) {
        require(disputes[tradeId].voteEnd != 0, "no-dispute");
        dispute = disputes[tradeId];
    }

    /**
     * @notice Reads user reputation score with default fallback.
     * @param user Address to query score for.
     * @return score Reputation score for user in [0, 1000].
     */
    function getReputation(address user) external view returns (uint256 score) {
        uint256 stored = reputation[user];
        score = stored == 0 ? DEFAULT_REPUTATION : stored;
    }

    /**
     * @dev Loads trade and reverts when trade does not exist.
     */
    function _getTrade(uint256 tradeId) internal view returns (Trade storage trade) {
        trade = trades[tradeId];
        require(trade.exists, "trade-not-found");
    }

    /**
     * @dev Applies release-path reputation updates for buyer and seller.
     */
    function _applyReleaseReputationUpdate(address buyer, address seller) internal {
        _applyDelta(buyer, int256(releaseReward));
        _applyDelta(seller, int256(releaseReward));
    }

    /**
     * @dev Applies dispute outcome reputation updates for winner and loser.
     */
    function _applyDisputeOutcomeReputation(address winner, address loser, bool decisive) internal {
        _applyDelta(winner, int256(disputeWinReward));
        if (decisive) {
            _applyDelta(loser, -int256(disputeLossPenalty));
        } else {
            _applyDelta(loser, -int256(disputeLossPenalty / 2));
        }
    }

    /**
     * @dev Updates score by signed delta while enforcing [MIN_REPUTATION, MAX_REPUTATION] bounds.
     */
    function _applyDelta(address user, int256 delta) internal {
        uint256 current = reputation[user];
        if (current == 0) {
            current = DEFAULT_REPUTATION;
        }

        uint256 next;
        if (delta >= 0) {
            next = current + uint256(delta);
            if (next > MAX_REPUTATION) {
                next = MAX_REPUTATION;
            }
        } else {
            uint256 decrement = uint256(-delta);
            if (decrement >= current) {
                next = MIN_REPUTATION;
            } else {
                next = current - decrement;
            }
        }

        reputation[user] = next;
        emit ReputationUpdated(user, current, next);
    }
}
