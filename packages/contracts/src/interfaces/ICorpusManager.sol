// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ICorpusManager
/// @notice Interface for a CORPUS-managed entity. The contract that implements this IS the
///         "algorithmic manager" of a Wyoming DAO LLC under W.S. 17-31-115. Every commercial
///         action the agent takes flows through this interface so the Operating Agreement
///         can reference it as the binding source of authority.
interface ICorpusManager {
    /// @dev Encoded as Articles of Organization metadata, hashed to commit-on-chain.
    struct EntityMetadata {
        string legalName; // e.g. "Loom Trading DAO LLC"
        string jurisdiction; // "WY"
        string filingId; // Wyoming Secretary of State filing ID, "" if unfiled (protocol-only mode)
        bytes32 articlesHash; // keccak256 of the Articles of Organization PDF (pinned to IPFS/Irys)
        bytes32 operatingAgreementHash; // keccak256 of the Operating Agreement PDF
        uint64 formedAt; // block.timestamp at formation
    }

    /// @dev On-chain spending policy enforced by the manager itself.
    struct SpendingPolicy {
        uint128 dailyCapUsdc; // 0 = no cap
        bool allowlistOnly; // true => only allowlisted counterparties can receive payments
    }

    event PaymentExecuted(
        address indexed counterparty, uint128 amount, bytes32 indexed memoHash
    );
    event AllowlistUpdated(address indexed counterparty, bool allowed);
    event PolicyUpdated(uint128 dailyCapUsdc, bool allowlistOnly);
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

    function metadata() external view returns (EntityMetadata memory);
    function policy() external view returns (SpendingPolicy memory);
    function identityTokenId() external view returns (uint256);
    function principal() external view returns (address);
    function mediator() external view returns (address);

    function pay(address counterparty, uint128 amount, bytes32 memoHash) external;
    function openDispute(address counterparty, uint128 amountClaimed, string calldata reason)
        external
        returns (uint256 disputeId);
    function resolveDispute(uint256 disputeId, uint128 awardToCounterparty, bytes32 evidenceHash)
        external;
}
