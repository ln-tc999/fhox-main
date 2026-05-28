// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {FhoxManager} from "./FhoxManager.sol";
import {IFhoxManager} from "./interfaces/IFhoxManager.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title FhoxFactory
/// @notice Single entrypoint for FHOX entity formation. One call deploys a FhoxManager,
///         mints an ERC-8004 identity NFT, and emits the on-chain Formation event that
///         becomes the entity's machine-readable birth record.
contract FhoxFactory is ReentrancyGuard {
    IERC20 public immutable usdc;
    IIdentityRegistry public immutable identityRegistry;

    /// @notice Maps a normalized (lowercase) legal-name hash → the manager address.
    mapping(bytes32 => address) public managerByName;

    error NameAlreadyTaken(string legalName, address existingManager);
    error EmptyLegalName();
    error ZeroAddress();

    /// @notice ERC-721 safe-transfer hook — the IdentityRegistry safe-mints to this contract.
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    event FhoxFormed(
        address indexed manager,
        address indexed principal,
        uint256 indexed identityTokenId,
        string legalName,
        string jurisdiction,
        string filingId,
        bytes32 articlesHash,
        bytes32 operatingAgreementHash
    );

    constructor(IERC20 usdc_, IIdentityRegistry identityRegistry_) {
        if (address(usdc_) == address(0) || address(identityRegistry_) == address(0)) {
            revert ZeroAddress();
        }
        usdc = usdc_;
        identityRegistry = identityRegistry_;
    }

    /// @notice Check whether a legal name is already registered.
    function isNameTaken(string calldata legalName)
        external
        view
        returns (bool taken, address existingManager)
    {
        bytes32 key = _nameKey(legalName);
        existingManager = managerByName[key];
        taken = existingManager != address(0);
    }

    /// @notice Form a FHOX entity in one transaction.
    /// @param md                   Entity metadata (legal name, jurisdiction, filing ID, etc.).
    /// @param encDailyCap          FHE-encrypted daily spending cap (ignored when hasDailyCap is false).
    /// @param hasDailyCap_         True if a daily cap should be enforced.
    /// @param allowlistOnly_       True if payments are restricted to the allowlist.
    /// @param principal_           EOA / smart account that controls the entity's commercial actions.
    /// @param mediator_            Address authorized to resolve disputes.
    /// @param identityMetadataURI  URI for the agent's ERC-8004 identity metadata.
    function form(
        IFhoxManager.EntityMetadata calldata md,
        InEuint128 calldata encDailyCap,
        bool hasDailyCap_,
        bool allowlistOnly_,
        address principal_,
        address mediator_,
        string calldata identityMetadataURI
    ) external nonReentrant returns (address manager, uint256 identityTokenId) {
        bytes32 nameKey = _nameKey(md.legalName);
        address existing = managerByName[nameKey];
        if (existing != address(0)) revert NameAlreadyTaken(md.legalName, existing);

        identityTokenId = identityRegistry.register(identityMetadataURI);

        FhoxManager m = new FhoxManager(usdc, address(this));
        m.initialize(md, encDailyCap, hasDailyCap_, allowlistOnly_, principal_, mediator_, identityTokenId);
        manager = address(m);

        managerByName[nameKey] = manager;

        IERC721 registry721 = IERC721(address(identityRegistry));
        if (principal_.code.length > 0) {
            registry721.transferFrom(address(this), principal_, identityTokenId);
        } else {
            registry721.safeTransferFrom(address(this), principal_, identityTokenId);
        }

        emit FhoxFormed(
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

    /// @dev Case-insensitive, whitespace-normalized name key.
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
}
