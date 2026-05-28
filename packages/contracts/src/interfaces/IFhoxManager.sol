// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

/// @title IFhoxManager
/// @notice Interface for a FHOX-managed entity. The contract that implements this IS the
///         "algorithmic manager" of a Wyoming DAO LLC under W.S. 17-31-115. Every commercial
///         action the agent takes flows through this interface so the Operating Agreement
///         can reference it as the binding source of authority.
///
/// @dev    Privacy model: payment amounts and daily spending totals are stored as FHE-encrypted
///         ciphertexts (euint128 via Fhenix CoFHE). Only the principal can unseal these values
///         by reading the encrypted handle and decrypting off-chain via cofhe-sdk.
///
///         Payments are two-phase due to CoFHE's async decrypt model:
///         1. pay()           — encrypts amount, enforces cap via FHE, requests async decrypt
///         2. executePayment() — callable once decrypt result is ready (next block+)
interface IFhoxManager {
    /// @dev Encoded as Articles of Organization metadata, hashed to commit on-chain.
    struct EntityMetadata {
        string legalName;
        string jurisdiction;
        string filingId;
        bytes32 articlesHash;
        bytes32 operatingAgreementHash;
        uint64 formedAt;
    }

    /// @dev Public view of spending policy — the cap value itself is private (FHE-encrypted).
    struct PolicyView {
        bool hasDailyCap;
        bool allowlistOnly;
    }

    // ── Events ──────────────────────────────────────────────────────────────────────────────

    /// @notice Emitted when a payment is initiated. Amount is never revealed.
    event PaymentInitiated(uint256 indexed paymentId, address indexed counterparty, bytes32 indexed memoHash);

    /// @notice Emitted when a pending payment is executed (transfer complete).
    event PaymentExecuted(address indexed counterparty, bytes32 indexed memoHash);

    event AllowlistUpdated(address indexed counterparty, bool allowed);
    event PolicyUpdated(bool hasDailyCap, bool allowlistOnly);
    event DisputeOpened(uint256 indexed disputeId, address indexed counterparty, string reason);
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed counterparty,
        uint128 awardToCounterparty,
        bytes32 evidenceHash
    );
    event PrincipalRotated(address indexed previous, address indexed next);
    event MediatorRotated(address indexed previous, address indexed next);
    event Initialized(address indexed principal, address indexed mediator, uint256 identityTokenId);

    // ── Reads ────────────────────────────────────────────────────────────────────────────────
    function metadata() external view returns (EntityMetadata memory);
    function policyView() external view returns (PolicyView memory);
    function identityTokenId() external view returns (uint256);
    function principal() external view returns (address);
    function mediator() external view returns (address);
    function treasuryBalance() external view returns (uint256);

    /// @notice Grant the caller (must be principal) ACL access to the encrypted daily-cap handle
    ///         and return the raw bytes32 handle. Decrypt off-chain with cofhe-sdk.
    function getSealedDailyCap() external returns (bytes32);

    /// @notice Grant the caller ACL access to today's encrypted spend total and return the handle.
    function getSealedTodaySpent() external returns (bytes32);

    // ── Writes ───────────────────────────────────────────────────────────────────────────────

    /// @notice Phase-1 payment: accept encrypted amount, apply FHE cap enforcement, request
    ///         async decrypt. Call executePayment(paymentId) once the decrypt result is ready
    ///         (>= 1 block later on mainnet/testnet; testnet evm_increaseTime in tests).
    function pay(address counterparty, InEuint128 calldata encAmount, bytes32 memoHash)
        external
        returns (uint256 paymentId);

    /// @notice Phase-2 payment: read the decrypted transfer amount and send USDC.
    ///         Reverts if decrypt is not yet ready (DecryptionResultNotReady).
    function executePayment(uint256 paymentId) external;

    function setAllowlist(address counterparty, bool allowed) external;

    /// @notice Update spending policy. `encDailyCap` is the FHE-encrypted cap value.
    function setPolicy(InEuint128 calldata encDailyCap, bool hasCap, bool allowlistOnly) external;

    function rotatePrincipal(address next) external;
    function rotateMediator(address next) external;

    function openDispute(address counterparty, uint128 amountClaimed, string calldata reason)
        external
        returns (uint256 disputeId);

    function resolveDispute(uint256 disputeId, uint128 awardToCounterparty, bytes32 evidenceHash)
        external;
}
