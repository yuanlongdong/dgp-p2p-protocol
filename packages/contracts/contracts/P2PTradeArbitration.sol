// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title P2PTradeArbitration
 * @notice End-to-end escrow, multi-stage dispute arbitration, reputation scoring, and deposit risk-control.
 * @dev Keeps CEI ordering, uses SafeERC20 for token accounting, and nonReentrant on value moving paths.
 */
contract P2PTradeArbitration is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum TradeStatus {
        Pending,
        Funded,
        Released,
        Refunded,
        Disputed,
        Arbitrated
    }

    enum ArbitrationOutcome {
        None,
        BuyerWin,
        SellerWin,
        Split,
        Tie
    }

    enum ArbitrationStage {
        None,
        Voting,
        Appeal,
        Resolved
    }

    struct Trade {
        uint256 id;
        address buyer;
        address seller;
        uint256 amount;
        uint64 deadline;
        TradeStatus status;
        bool exists;
        uint256 buyerDepositLocked;
        uint256 sellerDepositLocked;
        uint256 disputeId;
    }

    struct Dispute {
        uint256 disputeId;
        uint256 tradeId;
        address buyer;
        address seller;
        uint64 primaryDeadline;
        uint64 finalDeadline;
        uint32 voteCount;
        uint256 sumSellerBps;
        uint16 finalSellerBps;
        uint8 round;
        ArbitrationStage stage;
        bool resolved;
        ArbitrationOutcome outcome;
    }

    struct ReputationMetrics {
        uint64 completedTrades;
        uint64 successfulTrades;
        uint64 disputeWins;
        uint64 disputeLosses;
        uint128 cumulativeDepositVolume;
        uint128 activeExposure;
        uint256 score;
        bool initialized;
    }

    uint256 public constant DEFAULT_REPUTATION = 500;
    uint256 public constant MIN_REPUTATION = 0;
    uint256 public constant MAX_REPUTATION = 1000;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_TRADE_LIMIT = 50_000 ether;
    uint256 public constant DEPOSIT_NORMALIZER = 1_000 ether;

    uint64 public voteDuration = 3 days;
    uint64 public appealDuration = 2 days;
    uint32 public minVotesToResolve = 1;
    uint16 public slashBps = 5_000;

    IERC20 public immutable settlementToken;
    uint256 public nextTradeId;
    uint256 public nextDisputeId;

    mapping(uint256 => Trade) public trades;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => uint256) public disputeIdByTradeId;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint16)) public voteSellerBpsByArbitrator;
    mapping(address => ReputationMetrics) private metrics;
    mapping(address => bool) public isArbitrator;

    event TradeCreated(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline);
    event TradeFunded(uint256 indexed tradeId, address indexed buyer, uint256 amount);
    event EscrowReleased(uint256 indexed tradeId, address indexed seller, uint256 amount);
    event EscrowRefunded(uint256 indexed tradeId, address indexed buyer, uint256 amount);
    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed tradeId,
        address indexed buyer,
        address seller,
        uint64 primaryDeadline,
        uint64 finalDeadline
    );
    event DisputeStageAdvanced(uint256 indexed disputeId, ArbitrationStage stage, uint8 round, uint64 deadline);
    event VoteCast(uint256 indexed disputeId, address indexed arbitrator, uint16 sellerBps, uint32 voteCount, uint8 round);
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed tradeId,
        ArbitrationOutcome outcome,
        uint16 finalSellerBps,
        uint256 buyerAmount,
        uint256 sellerAmount
    );
    event ArbitratorUpdated(address indexed arbitrator, bool enabled);
    event ReputationUpdated(address indexed user, uint256 oldScore, uint256 newScore);
    event DepositLocked(uint256 indexed tradeId, address indexed participant, uint256 amount, uint16 depositBps);
    event DepositReleased(uint256 indexed tradeId, address indexed participant, uint256 amount);
    event DepositSlashed(uint256 indexed tradeId, address indexed participant, address indexed beneficiary, uint256 amount);
    event MinVotesToResolveUpdated(uint32 oldValue, uint32 newValue);
    event AppealDurationUpdated(uint64 oldValue, uint64 newValue);
    event SlashBpsUpdated(uint16 oldValue, uint16 newValue);

    constructor(address token) Ownable(msg.sender) {
        require(token != address(0), "token=0");
        settlementToken = IERC20(token);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setArbitrator(address arbitrator, bool enabled) external onlyOwner {
        require(arbitrator != address(0), "arbitrator=0");
        isArbitrator[arbitrator] = enabled;
        emit ArbitratorUpdated(arbitrator, enabled);
    }

    function setVoteDuration(uint64 newDuration) external onlyOwner {
        require(newDuration > 0, "duration=0");
        voteDuration = newDuration;
    }

    function setAppealDuration(uint64 newDuration) external onlyOwner {
        require(newDuration > 0, "appeal=0");
        uint64 old = appealDuration;
        appealDuration = newDuration;
        emit AppealDurationUpdated(old, newDuration);
    }

    function setMinVotesToResolve(uint32 newMinVotes) external onlyOwner {
        require(newMinVotes > 0, "min-votes=0");
        uint32 old = minVotesToResolve;
        minVotesToResolve = newMinVotes;
        emit MinVotesToResolveUpdated(old, newMinVotes);
    }

    function setSlashBps(uint16 newSlashBps) external onlyOwner {
        require(newSlashBps <= BPS_DENOMINATOR, "bad-bps");
        uint16 old = slashBps;
        slashBps = newSlashBps;
        emit SlashBpsUpdated(old, newSlashBps);
    }

    function createTrade(address seller, uint256 amount, uint64 deadline) external whenNotPaused returns (uint256 tradeId) {
        require(seller != address(0), "seller=0");
        require(seller != msg.sender, "same-party");
        require(amount > 0, "amount=0");
        require(deadline > block.timestamp, "bad-deadline");
        require(_canOpenTrade(msg.sender, amount), "trade-limit");
        require(_canOpenTrade(seller, amount), "counterparty-limit");

        tradeId = ++nextTradeId;
        trades[tradeId] = Trade({
            id: tradeId,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            deadline: deadline,
            status: TradeStatus.Pending,
            exists: true,
            buyerDepositLocked: 0,
            sellerDepositLocked: 0,
            disputeId: 0
        });

        emit TradeCreated(tradeId, msg.sender, seller, amount, deadline);
    }

    function fundTrade(uint256 tradeId) external nonReentrant whenNotPaused {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer, "only-buyer");
        require(trade.status == TradeStatus.Pending, "bad-status");

        trade.status = TradeStatus.Funded;
        settlementToken.safeTransferFrom(msg.sender, address(this), trade.amount);

        emit TradeFunded(tradeId, msg.sender, trade.amount);
    }

    function lockDeposit(uint256 tradeId) external nonReentrant whenNotPaused returns (uint256 requiredDeposit) {
        Trade storage trade = _getTrade(tradeId);
        require(trade.status == TradeStatus.Pending || trade.status == TradeStatus.Funded, "bad-status");
        require(msg.sender == trade.buyer || msg.sender == trade.seller, "not-party");

        requiredDeposit = _requiredDeposit(msg.sender, trade.amount);
        require(requiredDeposit > 0, "deposit=0");
        require(_canOpenTrade(msg.sender, trade.amount + requiredDeposit), "trade-limit");

        if (msg.sender == trade.buyer) {
            require(trade.buyerDepositLocked == 0, "deposit-exists");
            trade.buyerDepositLocked = requiredDeposit;
        } else {
            require(trade.sellerDepositLocked == 0, "deposit-exists");
            trade.sellerDepositLocked = requiredDeposit;
        }

        _increaseExposure(msg.sender, trade.amount + requiredDeposit);
        metrics[msg.sender].cumulativeDepositVolume += uint128(requiredDeposit);
        settlementToken.safeTransferFrom(msg.sender, address(this), requiredDeposit);

        emit DepositLocked(tradeId, msg.sender, requiredDeposit, getRequiredDepositBps(msg.sender));
    }

    function releaseDeposit(uint256 tradeId, address participant) public nonReentrant whenNotPaused returns (uint256 releasedAmount) {
        Trade storage trade = _getTrade(tradeId);
        require(_isTerminalStatus(trade.status), "trade-active");
        require(participant == trade.buyer || participant == trade.seller, "not-party");

        if (participant == trade.buyer) {
            releasedAmount = trade.buyerDepositLocked;
            require(releasedAmount > 0, "no-deposit");
            trade.buyerDepositLocked = 0;
        } else {
            releasedAmount = trade.sellerDepositLocked;
            require(releasedAmount > 0, "no-deposit");
            trade.sellerDepositLocked = 0;
        }

        _decreaseExposure(participant, trade.amount + releasedAmount);
        settlementToken.safeTransfer(participant, releasedAmount);
        emit DepositReleased(tradeId, participant, releasedAmount);
    }

    function slashDeposit(uint256 tradeId, address participant, address beneficiary)
        public
        nonReentrant
        whenNotPaused
        onlyOwner
        returns (uint256 slashedAmount)
    {
        Trade storage trade = _getTrade(tradeId);
        require(participant == trade.buyer || participant == trade.seller, "not-party");
        require(beneficiary != address(0), "beneficiary=0");

        uint256 locked = participant == trade.buyer ? trade.buyerDepositLocked : trade.sellerDepositLocked;
        require(locked > 0, "no-deposit");

        slashedAmount = (locked * slashBps) / BPS_DENOMINATOR;
        if (slashedAmount == 0) {
            slashedAmount = locked;
        }

        if (participant == trade.buyer) {
            trade.buyerDepositLocked = locked - slashedAmount;
        } else {
            trade.sellerDepositLocked = locked - slashedAmount;
        }

        _decreaseExposure(participant, slashedAmount);
        settlementToken.safeTransfer(beneficiary, slashedAmount);
        emit DepositSlashed(tradeId, participant, beneficiary, slashedAmount);
    }

    function releaseTrade(uint256 tradeId) external returns (uint256 sellerAmount) {
        return releaseEscrow(tradeId);
    }

    function releaseEscrow(uint256 tradeId) public nonReentrant whenNotPaused returns (uint256 sellerAmount) {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer, "only-buyer");
        require(trade.status == TradeStatus.Funded, "bad-status");

        trade.status = TradeStatus.Released;
        sellerAmount = trade.amount;
        settlementToken.safeTransfer(trade.seller, sellerAmount);
        _recordSuccessfulTrade(trade.buyer, trade.seller);
        _autoReleaseDeposits(tradeId, trade);

        emit EscrowReleased(tradeId, trade.seller, sellerAmount);
    }

    function refundAfterDeadline(uint256 tradeId) external returns (uint256 buyerAmount) {
        return refundEscrow(tradeId);
    }

    function refundEscrow(uint256 tradeId) public nonReentrant whenNotPaused returns (uint256 buyerAmount) {
        Trade storage trade = _getTrade(tradeId);
        require(trade.status == TradeStatus.Funded, "bad-status");
        require(block.timestamp >= trade.deadline, "not-expired");

        trade.status = TradeStatus.Refunded;
        buyerAmount = trade.amount;
        settlementToken.safeTransfer(trade.buyer, buyerAmount);
        _recordFailedTrade(trade.seller);
        _autoReleaseDeposits(tradeId, trade);

        emit EscrowRefunded(tradeId, trade.buyer, buyerAmount);
    }

    function openDispute(uint256 tradeId) external whenNotPaused returns (uint256 disputeId) {
        Trade storage trade = _getTrade(tradeId);
        require(msg.sender == trade.buyer || msg.sender == trade.seller, "not-party");
        require(trade.status == TradeStatus.Funded, "bad-status");
        require(disputeIdByTradeId[tradeId] == 0, "active-dispute");

        trade.status = TradeStatus.Disputed;
        disputeId = ++nextDisputeId;
        uint64 primaryDeadline = uint64(block.timestamp) + voteDuration;
        uint64 finalDeadline = primaryDeadline + appealDuration;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            tradeId: tradeId,
            buyer: trade.buyer,
            seller: trade.seller,
            primaryDeadline: primaryDeadline,
            finalDeadline: finalDeadline,
            voteCount: 0,
            sumSellerBps: 0,
            finalSellerBps: 0,
            round: 1,
            stage: ArbitrationStage.Voting,
            resolved: false,
            outcome: ArbitrationOutcome.None
        });

        trade.disputeId = disputeId;
        disputeIdByTradeId[tradeId] = disputeId;

        emit DisputeCreated(disputeId, tradeId, trade.buyer, trade.seller, primaryDeadline, finalDeadline);
    }

    function advanceDisputeStage(uint256 disputeId) external whenNotPaused {
        Dispute storage dispute = _getDispute(disputeId);
        require(!dispute.resolved, "resolved");

        if (dispute.stage == ArbitrationStage.Voting) {
            require(block.timestamp > dispute.primaryDeadline, "vote-active");
            dispute.stage = ArbitrationStage.Appeal;
            dispute.round = 2;
            emit DisputeStageAdvanced(disputeId, dispute.stage, dispute.round, dispute.finalDeadline);
            return;
        }

        if (dispute.stage == ArbitrationStage.Appeal) {
            require(block.timestamp > dispute.finalDeadline, "appeal-active");
            dispute.stage = ArbitrationStage.Resolved;
            emit DisputeStageAdvanced(disputeId, dispute.stage, dispute.round, dispute.finalDeadline);
            return;
        }

        revert("bad-stage");
    }

    function castVote(uint256 tradeId, bool supportBuyer) external whenNotPaused {
        uint256 disputeId = disputeIdByTradeId[tradeId];
        require(disputeId != 0, "no-dispute");
        vote(disputeId, supportBuyer ? 0 : uint16(BPS_DENOMINATOR));
    }

    function vote(uint256 disputeId, uint16 sellerBps) public whenNotPaused {
        require(isArbitrator[msg.sender], "not-arbitrator");
        require(sellerBps <= BPS_DENOMINATOR, "bad-bps");

        Dispute storage dispute = _getDispute(disputeId);
        require(!dispute.resolved, "resolved");
        require(dispute.stage == ArbitrationStage.Voting || dispute.stage == ArbitrationStage.Appeal, "not-votable");

        uint64 deadline = dispute.stage == ArbitrationStage.Voting ? dispute.primaryDeadline : dispute.finalDeadline;
        require(block.timestamp <= deadline, dispute.stage == ArbitrationStage.Voting ? "vote-closed" : "appeal-closed");
        require(!hasVoted[disputeId][msg.sender], "already-voted");

        hasVoted[disputeId][msg.sender] = true;
        voteSellerBpsByArbitrator[disputeId][msg.sender] = sellerBps;
        dispute.voteCount += 1;
        dispute.sumSellerBps += sellerBps;
        dispute.finalSellerBps = uint16(dispute.sumSellerBps / dispute.voteCount);

        emit VoteCast(disputeId, msg.sender, sellerBps, dispute.voteCount, dispute.round);
    }

    function resolveDispute(uint256 tradeId)
        external
        nonReentrant
        whenNotPaused
        returns (ArbitrationOutcome outcome, uint256 buyerAmount, uint256 sellerAmount)
    {
        uint256 disputeId = disputeIdByTradeId[tradeId];
        require(disputeId != 0, "no-dispute");
        return resolveDisputeById(disputeId);
    }

    function resolveDisputeById(uint256 disputeId)
        public
        whenNotPaused
        returns (ArbitrationOutcome outcome, uint256 buyerAmount, uint256 sellerAmount)
    {
        Dispute storage dispute = _getDispute(disputeId);
        Trade storage trade = _getTrade(dispute.tradeId);
        require(!dispute.resolved, "resolved");
        require(trade.status == TradeStatus.Disputed, "not-disputed");

        if (dispute.stage == ArbitrationStage.Voting) {
            require(block.timestamp > dispute.primaryDeadline, "vote-active");
            require(dispute.voteCount >= minVotesToResolve, "appeal-required");
        } else if (dispute.stage == ArbitrationStage.Appeal) {
            require(block.timestamp > dispute.finalDeadline, "appeal-active");
        } else {
            revert("bad-stage");
        }

        dispute.resolved = true;
        dispute.stage = ArbitrationStage.Resolved;
        trade.status = TradeStatus.Arbitrated;

        if (dispute.voteCount < minVotesToResolve) {
            outcome = ArbitrationOutcome.Tie;
            buyerAmount = trade.amount;
            settlementToken.safeTransfer(trade.buyer, buyerAmount);
            _recordDisputeResult(trade.buyer, trade.seller, false, false);
            _autoReleaseDeposits(dispute.tradeId, trade);
        } else {
            uint16 sellerBps = dispute.finalSellerBps;
            dispute.finalSellerBps = sellerBps;
            sellerAmount = (trade.amount * sellerBps) / BPS_DENOMINATOR;
            buyerAmount = trade.amount - sellerAmount;

            if (sellerAmount == 0) {
                outcome = ArbitrationOutcome.BuyerWin;
                _recordDisputeResult(trade.buyer, trade.seller, true, true);
                _slashLoserDepositIfAny(trade, trade.seller, trade.buyer);
            } else if (buyerAmount == 0) {
                outcome = ArbitrationOutcome.SellerWin;
                _recordDisputeResult(trade.seller, trade.buyer, true, true);
                _slashLoserDepositIfAny(trade, trade.buyer, trade.seller);
            } else {
                outcome = ArbitrationOutcome.Split;
                _recordDisputeResult(trade.buyer, trade.seller, true, false);
            }

            if (sellerAmount > 0) {
                settlementToken.safeTransfer(trade.seller, sellerAmount);
            }
            if (buyerAmount > 0) {
                settlementToken.safeTransfer(trade.buyer, buyerAmount);
            }

            _autoReleaseDeposits(dispute.tradeId, trade);
        }

        dispute.outcome = outcome;
        emit DisputeStageAdvanced(disputeId, dispute.stage, dispute.round, dispute.finalDeadline);
        emit DisputeResolved(disputeId, dispute.tradeId, outcome, dispute.finalSellerBps, buyerAmount, sellerAmount);
    }

    function updateReputation(address user) public returns (uint256 newScore) {
        require(user != address(0), "user=0");
        ReputationMetrics storage m = metrics[user];
        uint256 oldScore = getReputation(user);

        uint256 successComponent = m.completedTrades == 0
            ? 300
            : (uint256(m.successfulTrades) * 600) / uint256(m.completedTrades);

        uint256 disputeTotal = uint256(m.disputeWins) + uint256(m.disputeLosses);
        uint256 disputeComponent = disputeTotal == 0 ? 200 : (uint256(m.disputeWins) * 250) / disputeTotal;

        uint256 depositComponent = uint256(m.cumulativeDepositVolume) / DEPOSIT_NORMALIZER;
        if (depositComponent > 150) {
            depositComponent = 150;
        }

        newScore = successComponent + disputeComponent + depositComponent;
        if (newScore > MAX_REPUTATION) {
            newScore = MAX_REPUTATION;
        }

        m.score = newScore;
        m.initialized = true;
        emit ReputationUpdated(user, oldScore, newScore);
    }

    function getReputation(address user) public view returns (uint256 score) {
        ReputationMetrics storage m = metrics[user];
        if (!m.initialized) {
            return DEFAULT_REPUTATION;
        }
        score = m.score;
    }

    function getUserMetrics(address user) external view returns (ReputationMetrics memory) {
        ReputationMetrics memory m = metrics[user];
        if (!m.initialized) {
            m.score = DEFAULT_REPUTATION;
        }
        return m;
    }

    function getRequiredDepositBps(address user) public view returns (uint16) {
        uint256 score = getReputation(user);
        if (score >= 800) return 500;
        if (score >= 650) return 800;
        if (score >= 500) return 1200;
        if (score >= 300) return 1800;
        return 2500;
    }

    function getTradeLimit(address user) public view returns (uint256) {
        uint256 score = getReputation(user);
        if (score >= 800) return 200_000 ether;
        if (score >= 650) return 120_000 ether;
        if (score >= 500) return DEFAULT_TRADE_LIMIT;
        if (score >= 300) return 20_000 ether;
        return 5_000 ether;
    }

    function getFeeBps(address user) public view returns (uint16) {
        uint256 score = getReputation(user);
        if (score >= 800) return 20;
        if (score >= 650) return 35;
        if (score >= 500) return 50;
        if (score >= 300) return 80;
        return 120;
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory trade) {
        trade = _getTrade(tradeId);
    }

    function getDispute(uint256 tradeId) external view returns (Dispute memory dispute) {
        uint256 disputeId = disputeIdByTradeId[tradeId];
        require(disputeId != 0, "no-dispute");
        dispute = disputes[disputeId];
    }

    function getDisputeById(uint256 disputeId) external view returns (Dispute memory dispute) {
        dispute = _getDispute(disputeId);
    }

    function _getTrade(uint256 tradeId) internal view returns (Trade storage trade) {
        trade = trades[tradeId];
        require(trade.exists, "trade-not-found");
    }

    function _getDispute(uint256 disputeId) internal view returns (Dispute storage dispute) {
        dispute = disputes[disputeId];
        require(dispute.disputeId != 0, "no-dispute");
    }

    function _recordSuccessfulTrade(address buyer, address seller) internal {
        _markCompletedTrade(buyer, true);
        _markCompletedTrade(seller, true);
        updateReputation(buyer);
        updateReputation(seller);
    }

    function _recordFailedTrade(address loser) internal {
        _markCompletedTrade(loser, false);
        updateReputation(loser);
    }

    function _recordDisputeResult(address winner, address loser, bool completedTrade, bool decisive) internal {
        if (completedTrade) {
            _markCompletedTrade(winner, true);
            _markCompletedTrade(loser, false);
        }

        metrics[winner].disputeWins += 1;
        if (decisive) {
            metrics[loser].disputeLosses += 1;
        }

        updateReputation(winner);
        updateReputation(loser);
    }

    function _markCompletedTrade(address user, bool success) internal {
        ReputationMetrics storage m = metrics[user];
        m.completedTrades += 1;
        if (success) {
            m.successfulTrades += 1;
        }
    }

    function _requiredDeposit(address user, uint256 tradeAmount) internal view returns (uint256) {
        return (tradeAmount * getRequiredDepositBps(user)) / BPS_DENOMINATOR;
    }

    function _canOpenTrade(address user, uint256 amount) internal view returns (bool) {
        return uint256(metrics[user].activeExposure) + amount <= getTradeLimit(user);
    }

    function _increaseExposure(address user, uint256 amount) internal {
        metrics[user].activeExposure += uint128(amount);
    }

    function _decreaseExposure(address user, uint256 amount) internal {
        uint256 current = uint256(metrics[user].activeExposure);
        metrics[user].activeExposure = uint128(amount >= current ? 0 : current - amount);
    }

    function _autoReleaseDeposits(uint256 tradeId, Trade storage trade) internal {
        if (trade.buyerDepositLocked > 0) {
            uint256 buyerDeposit = trade.buyerDepositLocked;
            trade.buyerDepositLocked = 0;
            _decreaseExposure(trade.buyer, trade.amount + buyerDeposit);
            settlementToken.safeTransfer(trade.buyer, buyerDeposit);
            emit DepositReleased(tradeId, trade.buyer, buyerDeposit);
        }
        if (trade.sellerDepositLocked > 0) {
            uint256 sellerDeposit = trade.sellerDepositLocked;
            trade.sellerDepositLocked = 0;
            _decreaseExposure(trade.seller, trade.amount + sellerDeposit);
            settlementToken.safeTransfer(trade.seller, sellerDeposit);
            emit DepositReleased(tradeId, trade.seller, sellerDeposit);
        }
    }

    function _slashLoserDepositIfAny(Trade storage trade, address loser, address beneficiary) internal {
        uint256 locked = loser == trade.buyer ? trade.buyerDepositLocked : trade.sellerDepositLocked;
        if (locked == 0) {
            return;
        }

        uint256 slashedAmount = (locked * slashBps) / BPS_DENOMINATOR;
        if (slashedAmount == 0) {
            slashedAmount = locked;
        }

        if (loser == trade.buyer) {
            trade.buyerDepositLocked = locked - slashedAmount;
            _decreaseExposure(trade.buyer, slashedAmount);
        } else {
            trade.sellerDepositLocked = locked - slashedAmount;
            _decreaseExposure(trade.seller, slashedAmount);
        }

        settlementToken.safeTransfer(beneficiary, slashedAmount);
        emit DepositSlashed(trade.id, loser, beneficiary, slashedAmount);
    }

    function _isTerminalStatus(TradeStatus status) internal pure returns (bool) {
        return status == TradeStatus.Released || status == TradeStatus.Refunded || status == TradeStatus.Arbitrated;
    }
}
