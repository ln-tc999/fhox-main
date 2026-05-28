// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CorpusFactory} from "../src/CorpusFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/// @notice Deploys CorpusFactory pointed at Arc Testnet's canonical USDC + ERC-8004
///         IdentityRegistry. Run with:
///         forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC_URL --broadcast
contract Deploy is Script {
    // Arc Testnet canonical addresses
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address constant ARC_IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external returns (CorpusFactory factory) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        factory = new CorpusFactory(IERC20(ARC_USDC), IIdentityRegistry(ARC_IDENTITY_REGISTRY));
        vm.stopBroadcast();

        console2.log("CorpusFactory deployed at:", address(factory));
        console2.log("  usdc:             ", ARC_USDC);
        console2.log("  identityRegistry: ", ARC_IDENTITY_REGISTRY);

        _writeDeployment(address(factory));
    }

    function _writeDeployment(address factory) internal {
        string memory path = "deployments/arc-testnet.json";
        string memory json = string.concat(
            "{\n",
            '  "chainId": 5042002,\n',
            '  "factory": "',
            vm.toString(factory),
            '",\n',
            '  "usdc": "',
            vm.toString(ARC_USDC),
            '",\n',
            '  "identityRegistry": "',
            vm.toString(ARC_IDENTITY_REGISTRY),
            '"\n',
            "}\n"
        );
        vm.writeFile(path, json);
    }
}
