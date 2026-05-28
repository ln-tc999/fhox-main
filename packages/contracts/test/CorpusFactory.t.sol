// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CorpusFactory} from "../src/CorpusFactory.sol";
import {CorpusManager} from "../src/CorpusManager.sol";
import {ICorpusManager} from "../src/interfaces/ICorpusManager.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "../src/mocks/MockIdentityRegistry.sol";

contract CorpusFactoryTest is Test {
    CorpusFactory factory;
    MockUSDC usdc;
    MockIdentityRegistry registry;

    address principal = makeAddr("principal");
    address mediator = makeAddr("mediator");
    address counterparty = makeAddr("counterparty");

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockIdentityRegistry();
        factory = new CorpusFactory(usdc, registry);
    }

    function _baseMetadata() internal pure returns (ICorpusManager.EntityMetadata memory) {
        return ICorpusManager.EntityMetadata({
            legalName: "Loom Trading DAO LLC",
            jurisdiction: "WY",
            filingId: "",
            articlesHash: keccak256("articles.pdf"),
            operatingAgreementHash: keccak256("oa.pdf"),
            formedAt: 0
        });
    }

    function _basePolicy() internal pure returns (ICorpusManager.SpendingPolicy memory) {
        return ICorpusManager.SpendingPolicy({dailyCapUsdc: 1_000_000_000, allowlistOnly: false});
    }

    function test_form_deploysManagerAndMintsIdentity() public {
        (address manager, uint256 tokenId) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://agent-meta");

        assertTrue(manager != address(0));
        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(tokenId), principal); // NFT delivered to principal, not retained by factory

        CorpusManager m = CorpusManager(manager);
        assertEq(m.principal(), principal);
        assertEq(m.mediator(), mediator);
        assertEq(m.identityTokenId(), tokenId);
        assertEq(m.metadata().legalName, "Loom Trading DAO LLC");
    }

    function test_pay_succeedsWithinDailyCap() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);

        usdc.mint(manager, 500_000_000);

        vm.prank(principal);
        m.pay(counterparty, 100_000_000, keccak256("invoice-1"));

        assertEq(usdc.balanceOf(counterparty), 100_000_000);
        assertEq(m.todaySpent(), 100_000_000);
    }

    function test_pay_revertsOverDailyCap() public {
        (address manager,) = factory.form(
            _baseMetadata(),
            ICorpusManager.SpendingPolicy({dailyCapUsdc: 50_000_000, allowlistOnly: false}),
            principal,
            mediator,
            "ipfs://x"
        );
        CorpusManager m = CorpusManager(manager);
        usdc.mint(manager, 200_000_000);

        vm.prank(principal);
        vm.expectRevert(CorpusManager.DailyCapExceeded.selector);
        m.pay(counterparty, 60_000_000, keccak256("over"));
    }

    function test_pay_revertsWhenAllowlistOnlyAndNotAllowed() public {
        (address manager,) = factory.form(
            _baseMetadata(),
            ICorpusManager.SpendingPolicy({dailyCapUsdc: 0, allowlistOnly: true}),
            principal,
            mediator,
            "ipfs://x"
        );
        CorpusManager m = CorpusManager(manager);
        usdc.mint(manager, 100_000_000);

        vm.prank(principal);
        vm.expectRevert(CorpusManager.CounterpartyNotAllowed.selector);
        m.pay(counterparty, 1_000_000, keccak256("nope"));
    }

    function test_pay_succeedsAfterAllowlisting() public {
        (address manager,) = factory.form(
            _baseMetadata(),
            ICorpusManager.SpendingPolicy({dailyCapUsdc: 0, allowlistOnly: true}),
            principal,
            mediator,
            "ipfs://x"
        );
        CorpusManager m = CorpusManager(manager);
        usdc.mint(manager, 100_000_000);

        vm.startPrank(principal);
        m.setAllowlist(counterparty, true);
        m.pay(counterparty, 5_000_000, keccak256("ok"));
        vm.stopPrank();

        assertEq(usdc.balanceOf(counterparty), 5_000_000);
    }

    function test_pay_onlyPrincipal() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        usdc.mint(manager, 100_000_000);

        vm.prank(counterparty);
        vm.expectRevert(CorpusManager.NotPrincipal.selector);
        m.pay(counterparty, 1, bytes32(0));
    }

    function _makeKnownCounterparty(CorpusManager m) internal {
        usdc.mint(address(m), 200_000_000);
        vm.prank(principal);
        m.pay(counterparty, 10_000_000, keccak256("seed"));
    }

    function test_dispute_resolveAwardsCounterparty() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        _makeKnownCounterparty(m);

        vm.prank(counterparty);
        uint256 disputeId = m.openDispute(counterparty, 80_000_000, "non-delivery");
        assertEq(disputeId, 1);

        vm.prank(mediator);
        m.resolveDispute(disputeId, 80_000_000, keccak256("evidence.json"));

        // counterparty got 10M from seed + 80M from dispute
        assertEq(usdc.balanceOf(counterparty), 90_000_000);
    }

    function test_dispute_onlyMediatorCanResolve() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        _makeKnownCounterparty(m);

        vm.prank(counterparty);
        uint256 disputeId = m.openDispute(counterparty, 50_000_000, "x");

        vm.prank(principal);
        vm.expectRevert(CorpusManager.NotMediator.selector);
        m.resolveDispute(disputeId, 1, bytes32(0));
    }

    function test_dispute_awardCannotExceedAmountAtIssue() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        _makeKnownCounterparty(m);

        vm.prank(counterparty);
        uint256 disputeId = m.openDispute(counterparty, 10_000_000, "x");

        vm.prank(mediator);
        vm.expectRevert(CorpusManager.AwardExceedsClaim.selector);
        m.resolveDispute(disputeId, 11_000_000, bytes32(0));
    }

    function test_dispute_rejectsUnknownCounterparty() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(CorpusManager.NotCounterparty.selector);
        m.openDispute(stranger, 1, "scam");
    }

    function test_dispute_cooldownEnforced() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        _makeKnownCounterparty(m);

        vm.prank(counterparty);
        m.openDispute(counterparty, 1_000_000, "first");

        vm.prank(counterparty);
        vm.expectRevert(CorpusManager.DisputeCooldown.selector);
        m.openDispute(counterparty, 1_000_000, "too-soon");
    }

    function test_initialize_onlyFactory() public {
        CorpusManager m = new CorpusManager(usdc, address(this));
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(CorpusManager.NotFactory.selector);
        m.initialize(_baseMetadata(), _basePolicy(), principal, mediator, 1);
    }

    function test_rotatePrincipal() public {
        (address manager,) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://x");
        CorpusManager m = CorpusManager(manager);
        address next = makeAddr("next-principal");

        vm.prank(principal);
        m.rotatePrincipal(next);
        assertEq(m.principal(), next);
    }

    // ── Identity NFT ownership ───────────────────────────────────────────────

    /// @dev After formation the principal (agent) holds the identity NFT.
    ///      The manager stores the tokenId as its reference — together they form
    ///      the on-chain verifiable link: manager.identityTokenId → ownerOf == principal.
    function test_identityNft_ownedByPrincipal_afterFormation() public {
        (address manager, uint256 tokenId) =
            factory.form(_baseMetadata(), _basePolicy(), principal, mediator, "ipfs://agent-meta");

        // Principal's wallet holds the passport NFT
        assertEq(registry.ownerOf(tokenId), principal, "principal should own identity NFT");
        // Factory no longer holds it
        assertFalse(registry.ownerOf(tokenId) == address(factory), "factory must not retain NFT");
        // Manager records the tokenId as its reference
        assertEq(CorpusManager(manager).identityTokenId(), tokenId, "manager must reference the tokenId");
    }

    /// @dev Smart-contract principals (Safe, ERC-4337) without IERC721Receiver
    ///      must still receive the NFT via plain transferFrom — formation must not revert.
    function test_identityNft_contractPrincipal_noReceiverHook() public {
        // Deploy a minimal contract that has no onERC721Received — simulates a
        // smart account or Safe wallet that hasn't implemented the hook.
        address contractPrincipal = address(new ContractWallet());

        (address manager, uint256 tokenId) =
            factory.form(_baseMetadata(), _basePolicy(), contractPrincipal, mediator, "ipfs://x");

        assertEq(registry.ownerOf(tokenId), contractPrincipal, "contract principal should own NFT");
        assertEq(CorpusManager(manager).identityTokenId(), tokenId);
    }

    /// @dev Smart-contract principals that DO implement IERC721Receiver get the
    ///      safe transfer path and the callback fires correctly.
    function test_identityNft_contractPrincipal_withReceiverHook() public {
        address contractPrincipal = address(new ContractWalletWithReceiver());

        (, uint256 tokenId) =
            factory.form(_baseMetadata(), _basePolicy(), contractPrincipal, mediator, "ipfs://x");

        assertEq(registry.ownerOf(tokenId), contractPrincipal);
    }
}

// ── Helper contracts for smart-account edge case tests ───────────────────────

/// @dev Simulates a contract wallet with no ERC721 receiver hook (e.g. older Safe).
contract ContractWallet {
    // Intentionally does NOT implement onERC721Received
}

/// @dev Simulates a contract wallet that properly implements IERC721Receiver.
contract ContractWalletWithReceiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
