// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IIdentityRegistry
/// @notice Minimal interface for the ERC-8004 IdentityRegistry deployed on Arc at
///         0x8004A818BFB912233c491871b3d84c89A494BD9e. Mints an ERC-721 identity NFT
///         and emits a standard Transfer(from=0x0, to, tokenId) event on registration.
interface IIdentityRegistry {
    function register(string calldata metadataURI) external returns (uint256 tokenId);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}
