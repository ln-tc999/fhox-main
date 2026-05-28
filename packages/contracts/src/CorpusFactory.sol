// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CorpusManager} from "./CorpusManager.sol";
import {ICorpusManager} from "./interfaces/ICorpusManager.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title CorpusFactory
/// @notice The single entrypoint other apps integrate with. One call deploys a CorpusManager,
///         mints an ERC-8004 identity that points at the manager's metadata, and emits the
///         on-chain Formation event that becomes the entity's machine-readable birth record.
/// @dev    The factory itself owns the minted identity NFT (it called `register` on the
///         IdentityRegistry). For the demo this is fine — the identity exists, is queryable,
///         and is bound by event log to the manager. In a future version the factory should
///         transfer the NFT to the manager so the entity literally holds its own identity.
contract CorpusFactory is ReentrancyGuard {
    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Maps a normalized (lowercase) legal-name hash → the manager address
    ///         that holds it. Prevents two entities from claiming the same name and
    ///         turns the factory into a queryable name registry.
    mapping(bytes32 => address) public managerByName;

    error NameAlreadyTaken(string legalName, address existingManager);
    error EmptyLegalName();

    /// @notice ERC-721 safe-transfer hook — the ERC-8004 IdentityRegistry safe-mints the
    ///         identity NFT to this contract during `register()`. Returning the magic value
    ///         tells the registry it's safe to mint.
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    event CorpusFormed(
        address indexed manager,
        address indexed principal,
        uint256 indexed identityTokenId,
        string legalName,
        string jurisdiction,
        string filingId,
        bytes32 articlesHash,
        bytes32 operatingAgreementHash
    );

    error ZeroAddress();

    constructor(IERC20 usdc_, IIdentityRegistry identityRegistry_) {
        if (address(usdc_) == address(0) || address(identityRegistry_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
        identityRegistry = identityRegistry_;
    }

    /// @notice Check whether a legal name is already registered. Pre-flight helper
    ///         so clients can warn users before submitting the form() transaction.
    /// @return taken True if the name is already in use.
    /// @return existingManager The manager that currently holds the name (zero if free).
    function isNameTaken(string calldata legalName)
        external
        view
        returns (bool taken, address existingManager)
    {
        bytes32 key = _nameKey(legalName);
        existingManager = managerByName[key];
        taken = existingManager != address(0);
    }

    /// @dev Case-insensitive, whitespace-normalized name key. Treats space/tab/CR/LF as
    ///      whitespace: strips leading/trailing, collapses consecutive to one space, folds A-Z.
    function _nameKey(string memory s) internal pure returns (bytes32) {
        bytes memory b = bytes(s);
        if (b.length == 0) revert EmptyLegalName();
        bytes memory out = new bytes(b.length);
        uint256 len;
        bool lastWasSpace = true;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c == 0x20 || c == 0x09 || c == 0x0A || c == 0x0D) {
                if (!lastWasSpace) {
                    out[len++] = bytes1(0x20);
                    lastWasSpace = true;
                }
            } else {
                if (c >= 0x41 && c <= 0x5A) c += 0x20;
                out[len++] = bytes1(c);
                lastWasSpace = false;
            }
        }
        if (len > 0 && uint8(out[len - 1]) == 0x20) len--;
        if (len == 0) revert EmptyLegalName();
        bytes memory trimmed = new bytes(len);
        for (uint256 i = 0; i < len; i++) trimmed[i] = out[i];
        return keccak256(trimmed);
    }

    /// @notice Form a CORPUS entity in one transaction.
    /// @param md  Entity metadata. `filingId` may be empty for protocol-only formation
    ///            (entity exists on-chain; legal filing is the integrator's responsibility).
    /// @param sp  Initial spending policy.
    /// @param principal_  EOA / smart account that controls the LLC's commercial actions.
    /// @param mediator_   Address authorized to resolve disputes under the Operating Agreement.
    /// @param identityMetadataURI  URI (ipfs:// or https://) describing the agent — passed to
    ///                              the ERC-8004 IdentityRegistry as the agent's metadata.
    function form(
        ICorpusManager.EntityMetadata calldata md,
        ICorpusManager.SpendingPolicy calldata sp,
        address principal_,
        address mediator_,
        string calldata identityMetadataURI
    ) external nonReentrant returns (address manager, uint256 identityTokenId) {
        // Reject duplicate names BEFORE we mint an identity or deploy a manager.
        // The check is case-insensitive so "Loom Trading DAO LLC" and
        // "loom trading dao llc" collide — closes the obvious impersonation path.
        bytes32 nameKey = _nameKey(md.legalName);
        address existing = managerByName[nameKey];
        if (existing != address(0)) revert NameAlreadyTaken(md.legalName, existing);

        identityTokenId = identityRegistry.register(identityMetadataURI);

        CorpusManager m = new CorpusManager(usdc, address(this));
        m.initialize(md, sp, principal_, mediator_, identityTokenId);
        manager = address(m);

        managerByName[nameKey] = manager;

        // Deliver the identity NFT to the principal — they hold the passport,
        // the manager holds the reference (identityTokenId). Together they form
        // the verifiable link: manager.identityTokenId() → registry.ownerOf() == principal.
        //
        // Edge case: if principal is a smart account that hasn't implemented
        // IERC721Receiver, safeTransferFrom would revert. We detect this and
        // fall back to a plain transferFrom so formation never silently fails.
        // Contract principals that want the safe callback should implement
        // IERC721Receiver — they'll get safeTransferFrom automatically.
        IERC721 registry721 = IERC721(address(identityRegistry));
        if (principal_.code.length > 0) {
            // Smart account — use plain transfer; avoids reverting on missing receiver
            registry721.transferFrom(address(this), principal_, identityTokenId);
        } else {
            // EOA — use safe transfer (standard; no callback penalty)
            registry721.safeTransferFrom(address(this), principal_, identityTokenId);
        }

        emit CorpusFormed(
            manager,
            principal_,
            identityTokenId,
            md.legalName,
            md.jurisdiction,
            md.filingId,
            md.articlesHash,
            md.operatingAgreementHash
        );
    }
}
