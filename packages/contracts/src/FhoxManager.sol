// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FHE, euint128, ebool, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {IFhoxManager} from "./interfaces/IFhoxManager.sol";

/// @title FhoxManager
/// @notice The on-chain algorithmic manager of a Wyoming DAO LLC. Under W.S. 17-31-115, when
///         the Articles of Organization name a smart contract as manager and the Operating
///         Agreement references this contract by address, this contract's behavior is the
///         legally operative authority of the entity.
///
/// @dev    Privacy-by-design: payment amounts and daily spending totals are stored as FHE
///         ciphertexts (euint128 via Fhenix CoFHE). The daily-cap policy is enforced on
///         encrypted values using FHE arithmetic — no on-chain observer can determine how
///         much the agent spent or what its cap is.
///
///         Payments are two-phase (CoFHE async decrypt model):
///         1. pay()           — FHE cap computation + createDecryptTask
///         2. executePayment() — read getDecryptResult + USDC transfer (≥1 block later)
contract FhoxManager is IFhoxManager, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // CoFHE task manager — same address on all supported networks (mock included).
    address private constant COFHE_TASK_MANAGER = 0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9;

    error NotFactory();
    error NotPrincipal();
    error NotMediator();
    error EmptyCounterparty();
    error CounterpartyNotAllowed();
    error DisputeNotOpen();
    error AwardExceedsClaim();
    error AlreadyInitialized();
    error ZeroAddress();
    error NotCounterparty();
    error DisputeCooldown();
    error PrincipalMediatorCollision();
    error PaymentAlreadyExecuted();
    error PaymentNotFound();

    enum DisputeStatus {
        None,
        Open,
        Resolved
    }

    struct Dispute {
        address counterparty;
        uint128 amountAtIssue; // plaintext — mediator needs full visibility
        DisputeStatus status;
        uint64 openedAt;
    }

    struct PendingPayment {
        address counterparty;
        bytes32 encActualAmountHandle; // euint128 handle (unwrapped bytes32)
        bytes32 memoHash;
        bool executed;
    }

    uint256 public constant DISPUTE_COOLDOWN = 1 days;

    IERC20 public immutable usdc;
    address public immutable factory;

    // ─── Entity / actors ─────────────────────────────────────────────────────────────────
    EntityMetadata internal _metadata;
    uint256 public override identityTokenId;
    address public override principal;
    address public override mediator;

    // ─── Encrypted spending policy ───────────────────────────────────────────────────────
    euint128 internal _encDailyCap;
    mapping(uint256 => euint128) internal _encSpentOnDay; // day-index => encrypted USDC out

    // ─── Public policy flags (metadata only, values are private) ────────────────────────
    bool public hasDailyCap;
    bool public allowlistOnly;

    // ─── Counterparty tracking ───────────────────────────────────────────────────────────
    mapping(address => bool) public allowlist;
    mapping(address => bool) public knownCounterparty;

    // ─── Two-phase payments ──────────────────────────────────────────────────────────────
    uint256 public nextPaymentId;
    mapping(uint256 => PendingPayment) public pendingPayments;

    // ─── Disputes ────────────────────────────────────────────────────────────────────────
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
    /// @param encDailyCap FHE-encrypted initial daily cap. Ignored when hasCap_ is false.
    function initialize(
        EntityMetadata calldata md,
        InEuint128 calldata encDailyCap,
        bool hasCap_,
        bool allowlistOnly_,
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
        hasDailyCap = hasCap_;
        allowlistOnly = allowlistOnly_;
        if (hasCap_) {
            _encDailyCap = FHE.asEuint128(encDailyCap);
            FHE.allowThis(_encDailyCap);
        } else {
            // Store trivially-encrypted zero (not used when hasDailyCap is false)
            _encDailyCap = FHE.asEuint128(uint256(0));
        }
        principal = principal_;
        mediator = mediator_;
        identityTokenId = identityTokenId_;
        emit Initialized(principal_, mediator_, identityTokenId_);
    }

    // ─── Views ───────────────────────────────────────────────────────────────────────────

    function metadata() external view override returns (EntityMetadata memory) {
        return _metadata;
    }

    function policyView() external view override returns (PolicyView memory) {
        return PolicyView({hasDailyCap: hasDailyCap, allowlistOnly: allowlistOnly});
    }

    function treasuryBalance() external view override returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Grant the caller (principal) ACL access to the encrypted daily-cap handle,
    ///         then return the handle. Decrypt off-chain via cofhe-sdk.
    function getSealedDailyCap() external override onlyPrincipal returns (bytes32) {
        FHE.allowSender(_encDailyCap);
        return euint128.unwrap(_encDailyCap);
    }

    /// @notice Grant the caller ACL access to today's encrypted spend total and return the handle.
    function getSealedTodaySpent() external override onlyPrincipal returns (bytes32) {
        uint256 day = block.timestamp / 1 days;
        euint128 spent = _encSpentOnDay[day];
        FHE.allowSender(spent);
        return euint128.unwrap(spent);
    }

    // ─── Two-phase payment ───────────────────────────────────────────────────────────────

    /// @notice Phase 1: Submit an encrypted payment. Applies FHE cap enforcement and requests
    ///         async decryption. The payment amount is never visible on-chain.
    ///
    ///         Cap enforcement (FHE-native): instead of reverting when the cap is hit, the
    ///         actual transfer is silently capped at the remaining daily budget.
    function pay(address counterparty, InEuint128 calldata encAmount, bytes32 memoHash)
        external
        override
        nonReentrant
        onlyPrincipal
        returns (uint256 paymentId)
    {
        if (counterparty == address(0)) revert EmptyCounterparty();
        if (allowlistOnly && !allowlist[counterparty]) revert CounterpartyNotAllowed();

        euint128 amount = FHE.asEuint128(encAmount);
        euint128 actualAmount;
        uint256 day = block.timestamp / 1 days;

        if (hasDailyCap) {
            euint128 spent = _encSpentOnDay[day];
            euint128 newTotal = FHE.add(spent, amount);

            // FHE cap enforcement: pick min(amount, remaining)
            ebool withinCap = FHE.lte(newTotal, _encDailyCap);
            ebool spentLtCap = FHE.lt(spent, _encDailyCap);
            euint128 remaining =
                FHE.select(spentLtCap, FHE.sub(_encDailyCap, spent), FHE.asEuint128(uint256(0)));
            actualAmount = FHE.select(withinCap, amount, remaining);

            euint128 newSpent = FHE.add(spent, actualAmount);
            FHE.allowThis(newSpent);
            _encSpentOnDay[day] = newSpent;
        } else {
            actualAmount = amount;
            euint128 newSpent = FHE.add(_encSpentOnDay[day], amount);
            FHE.allowThis(newSpent);
            _encSpentOnDay[day] = newSpent;
        }

        // Grant this contract persistent ACL so createDecryptTask can access the handle
        FHE.allowThis(actualAmount);
        // Request async decryption — result available in ≥1 block
        ITaskManager(COFHE_TASK_MANAGER).createDecryptTask(
            uint256(euint128.unwrap(actualAmount)), address(this)
        );

        paymentId = ++nextPaymentId;
        pendingPayments[paymentId] = PendingPayment({
            counterparty: counterparty,
            encActualAmountHandle: euint128.unwrap(actualAmount),
            memoHash: memoHash,
            executed: false
        });
        knownCounterparty[counterparty] = true;
        emit PaymentInitiated(paymentId, counterparty, memoHash);
    }

    /// @notice Phase 2: Once the CoFHE decrypt result is ready, execute the USDC transfer.
    ///         Anyone may call this (principal, keeper, etc.) — the counterparty is locked in
    ///         from Phase 1 and cannot be changed.
    function executePayment(uint256 paymentId) external override nonReentrant {
        PendingPayment storage p = pendingPayments[paymentId];
        if (p.counterparty == address(0)) revert PaymentNotFound();
        if (p.executed) revert PaymentAlreadyExecuted();

        // Reverts with DecryptionResultNotReady if the async decrypt isn't done yet
        uint128 transferAmt = FHE.getDecryptResult(euint128.wrap(p.encActualAmountHandle));

        p.executed = true;
        if (transferAmt > 0) {
            usdc.safeTransfer(p.counterparty, transferAmt);
        }
        // Amount intentionally omitted from event — privacy by design
        emit PaymentExecuted(p.counterparty, p.memoHash);
    }

    // ─── Policy + allowlist ──────────────────────────────────────────────────────────────

    function setAllowlist(address counterparty, bool allowed) external override onlyPrincipal {
        allowlist[counterparty] = allowed;
        emit AllowlistUpdated(counterparty, allowed);
    }

    /// @notice Update spending policy. `encDailyCap` is a Fhenix-encrypted value.
    function setPolicy(InEuint128 calldata encDailyCap, bool hasCap_, bool allowlistOnly_)
        external
        override
        onlyPrincipal
    {
        hasDailyCap = hasCap_;
        allowlistOnly = allowlistOnly_;
        if (hasCap_) {
            _encDailyCap = FHE.asEuint128(encDailyCap);
            FHE.allowThis(_encDailyCap);
        } else {
            _encDailyCap = FHE.asEuint128(uint256(0));
        }
        emit PolicyUpdated(hasCap_, allowlistOnly_);
    }

    function rotatePrincipal(address next) external override onlyPrincipal {
        if (next == address(0)) revert ZeroAddress();
        if (next == mediator) revert PrincipalMediatorCollision();
        emit PrincipalRotated(principal, next);
        principal = next;
    }

    function rotateMediator(address next) external override onlyPrincipal {
        if (next == address(0)) revert ZeroAddress();
        if (next == principal) revert PrincipalMediatorCollision();
        emit MediatorRotated(mediator, next);
        mediator = next;
    }

    // ─── Disputes ────────────────────────────────────────────────────────────────────────

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
