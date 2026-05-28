// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @notice Local-test stand-in for the Arc ERC-8004 IdentityRegistry. Returns a monotonically
///         increasing tokenId on register() and emits the canonical Transfer event so tests can
///         assert against the same log shape the real registry produces.
///         Implements the IERC721 transfer surface so FhoxFactory can deliver NFTs to principals.
contract MockIdentityRegistry is IIdentityRegistry, IERC721 {
    uint256 public nextTokenId = 1;
    mapping(uint256 => address) internal _owners;
    mapping(uint256 => string) internal _uris;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;
    mapping(uint256 => address) internal _tokenApprovals;

    // ── IIdentityRegistry ────────────────────────────────────────────────────

    function register(string calldata metadataURI) external override returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _owners[tokenId] = msg.sender;
        _uris[tokenId] = metadataURI;
        emit Transfer(address(0), msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) external view override returns (string memory) {
        return _uris[tokenId];
    }

    // ── IERC721 ──────────────────────────────────────────────────────────────

    function ownerOf(uint256 tokenId) external view override(IIdentityRegistry, IERC721) returns (address) {
        return _owners[tokenId];
    }

    function transferFrom(address from, address to, uint256 tokenId) external override {
        require(_owners[tokenId] == from, "not owner");
        require(
            msg.sender == from || _operatorApprovals[from][msg.sender] || _tokenApprovals[tokenId] == msg.sender,
            "not approved"
        );
        _owners[tokenId] = to;
        delete _tokenApprovals[tokenId];
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        _safeTransfer(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        _safeTransfer(from, to, tokenId, data);
    }

    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory data) internal {
        require(_owners[tokenId] == from, "not owner");
        require(
            msg.sender == from || _operatorApprovals[from][msg.sender] || _tokenApprovals[tokenId] == msg.sender,
            "not approved"
        );
        _owners[tokenId] = to;
        delete _tokenApprovals[tokenId];
        emit Transfer(from, to, tokenId);
        if (to.code.length > 0) {
            require(
                IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data)
                    == IERC721Receiver.onERC721Received.selector,
                "unsafe recipient"
            );
        }
    }

    function approve(address to, uint256 tokenId) external override {
        _tokenApprovals[tokenId] = to;
        emit Approval(_owners[tokenId], to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external override {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId) external view override returns (address) {
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function balanceOf(address) external pure override returns (uint256) {
        return 0;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC721).interfaceId;
    }
}
