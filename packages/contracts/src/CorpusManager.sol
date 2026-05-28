// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICorpusManager} from "./interfaces/ICorpusManager.sol";

/// @title CorpusManager
/// @notice The on-chain algorithmic manager of a Wyoming DAO LLC. Under W.S. 17-31-115, when
///         the Articles of Organization name a smart contract as manager and the Operating
///         Agreement references this contract by address, this contract's behavior is the
///         legally operative authority of the entity. The principal (human or agent EOA) is
///         the recognized member/operator of the LLC for the purpose of authorizing actions;
///         the mediator is the binding dispute-resolution authority named in the OA.
/// @dev    The contract holds a USDC ERC-20 balance as its treasury. On Arc, USDC is the native
///         gas asset; the ERC-20 interface at the canonical USDC address operates on the same
///         balance, so payments out of this contract pay their own gas implicitly.
contract CorpusManager is ICorpusManager, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotFactory();
    error NotPrincipal();
    error NotMediator();
    error EmptyCounterparty();
    error CounterpartyNotAllowed();
    error DailyCapExceeded();
    error DisputeNotOpen();
    error AwardExceedsClaim();
    error AlreadyInitialized();
    error ZeroAddress();
    error NotCounterparty();
    error DisputeCooldown();
    error PrincipalMediatorCollision();

    enum DisputeStatus {
        None,
        Open,
        Resolved
    }

    struct Dispute {
        address counterparty;
        uint128 amountAtIssue;
        DisputeStatus status;
        uint64 openedAt;
    }

    uint256 public constant DISPUTE_COOLDOWN = 1 days;

    IERC20 public immutable usdc;
    address public immutable factory;

    // ─── Entity / actors ────────────────────────────────────────────────────────────────
    EntityMetadata internal _metadata;
    SpendingPolicy internal _policy;
    uint256 public override identityTokenId;
    address public override principal;
    address public override mediator;

    // ─── Spending policy state ──────────────────────────────────────────────────────────
    mapping(address => bool) public allowlist;
    mapping(uint256 => uint128) public spentOnDay; // day-index (block.timestamp / 1 days) => USDC out

    // ─── Counterparty tracking ──────────────────────────────────────────────────────────
    mapping(address => bool) public knownCounterparty;

    // ─── Disputes ───────────────────────────────────────────────────────────────────────
    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint64) public lastDisputeAt;

    bool private _initialized;

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier onlyPrincipal() {
        if (msg.sender != principal) revert NotPrincipal();
        _;
    }

    modifier onlyMediator() {
        if (msg.sender != mediator) revert NotMediator();
        _;
    }

    constructor(IERC20 usdc_, address factory_) {
        if (address(usdc_) == address(0) || factory_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        factory = factory_;
    }

    /// @notice One-shot initializer, callable only by the factory that deployed this manager.
    function initialize(
        EntityMetadata calldata md,
        SpendingPolicy calldata sp,
        address principal_,
        address mediator_,
        uint256 identityTokenId_
    ) external onlyFactory {
        if (_initialized) revert AlreadyInitialized();
        if (principal_ == address(0) || mediator_ == address(0)) revert ZeroAddress();
        if (principal_ == mediator_) revert PrincipalMediatorCollision();
        _initialized = true;
        _metadata = md;
        _metadata.formedAt = uint64(block.timestamp);
        _policy = sp;
        principal = principal_;
        mediator = mediator_;
        identityTokenId = identityTokenId_;
        emit Initialized(principal_, mediator_, identityTokenId_);
    }

    // ─── Views ──────────────────────────────────────────────────────────────────────────

    function metadata() external view override returns (EntityMetadata memory) {
        return _metadata;
    }

    function policy() external view override returns (SpendingPolicy memory) {
        return _policy;
    }

    function treasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function todaySpent() external view returns (uint256) {
        return spentOnDay[block.timestamp / 1 days];
    }

    // ─── Treasury operations ────────────────────────────────────────────────────────────

    /// @notice Execute a USDC payment to a counterparty under the configured policy.
    function pay(address counterparty, uint128 amount, bytes32 memoHash)
        external
        override
        nonReentrant
        onlyPrincipal
    {
        if (counterparty == address(0)) revert EmptyCounterparty();
        if (_policy.allowlistOnly && !allowlist[counterparty]) revert CounterpartyNotAllowed();

        if (_policy.dailyCapUsdc != 0) {
            uint256 day = block.timestamp / 1 days;
            uint128 newTotal = spentOnDay[day] + amount;
            if (newTotal > _policy.dailyCapUsdc) revert DailyCapExceeded();
            spentOnDay[day] = newTotal;
        }

        knownCounterparty[counterparty] = true;
        usdc.safeTransfer(counterparty, amount);
        emit PaymentExecuted(counterparty, amount, memoHash);
    }

    function setAllowlist(address counterparty, bool allowed) external onlyPrincipal {
        allowlist[counterparty] = allowed;
        emit AllowlistUpdated(counterparty, allowed);
    }

    function setPolicy(SpendingPolicy calldata sp) external onlyPrincipal {
        _policy = sp;
        emit PolicyUpdated(sp.dailyCapUsdc, sp.allowlistOnly);
    }

    function rotatePrincipal(address next) external onlyPrincipal {
        if (next == address(0)) revert ZeroAddress();
        if (next == mediator) revert PrincipalMediatorCollision();
        emit PrincipalRotated(principal, next);
        principal = next;
    }

    function rotateMediator(address next) external onlyPrincipal {
        if (next == address(0)) revert ZeroAddress();
        if (next == principal) revert PrincipalMediatorCollision();
        emit MediatorRotated(mediator, next);
        mediator = next;
    }

    // ─── Disputes ───────────────────────────────────────────────────────────────────────

    /// @notice Open a dispute. Only the principal or a counterparty with prior payment
    ///         history may open. Subject to a per-counterparty cooldown to prevent spam.
    function openDispute(address counterparty, uint128 amountClaimed, string calldata reason)
        external
        override
        nonReentrant
        returns (uint256 disputeId)
    {
        if (counterparty == address(0)) revert EmptyCounterparty();
        if (!knownCounterparty[counterparty]) revert NotCounterparty();
        if (msg.sender != principal && msg.sender != counterparty) revert NotPrincipal();

        uint64 last = lastDisputeAt[counterparty];
        if (last != 0 && block.timestamp - last < DISPUTE_COOLDOWN) revert DisputeCooldown();

        uint256 bal = usdc.balanceOf(address(this));
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 cap = bal > type(uint128).max ? type(uint128).max : uint128(bal);
        if (amountClaimed > cap) amountClaimed = cap;

        disputeId = ++nextDisputeId;
        disputes[disputeId] = Dispute({
            counterparty: counterparty,
            amountAtIssue: amountClaimed,
            status: DisputeStatus.Open,
            openedAt: uint64(block.timestamp)
        });
        lastDisputeAt[counterparty] = uint64(block.timestamp);
        emit DisputeOpened(disputeId, counterparty, reason);
    }

    /// @notice Mediator delivers an attested resolution. The award is paid out of the
    ///         treasury directly; the off-chain attestation (evidenceHash) is the legally
    ///         operative record per the Operating Agreement.
    function resolveDispute(uint256 disputeId, uint128 awardToCounterparty, bytes32 evidenceHash)
        external
        override
        nonReentrant
        onlyMediator
    {
        Dispute storage d = disputes[disputeId];
        if (d.status != DisputeStatus.Open) revert DisputeNotOpen();
        if (awardToCounterparty > d.amountAtIssue) revert AwardExceedsClaim();

        d.status = DisputeStatus.Resolved;
        if (awardToCounterparty > 0) {
            usdc.safeTransfer(d.counterparty, awardToCounterparty);
        }
        emit DisputeResolved(disputeId, d.counterparty, awardToCounterparty, evidenceHash);
    }
}
