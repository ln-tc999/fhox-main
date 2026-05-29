// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {FhoxFactory} from "../src/FhoxFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

/// @notice Deploys FhoxFactory pointed at Arbitrum Sepolia's USDC + ERC-8004 IdentityRegistry.
///         Run with:
///         forge script script/Deploy.s.sol:Deploy --rpc-url $FHENIX_RPC_URL --broadcast
contract Deploy is Script {
    // Arbitrum Sepolia deployed addresses
    address constant DEPLOYED_USDC = 0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D;
    address constant DEPLOYED_IDENTITY_REGISTRY = 0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185;

    function run() external returns (FhoxFactory factory) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        factory = new FhoxFactory(IERC20(DEPLOYED_USDC), IIdentityRegistry(DEPLOYED_IDENTITY_REGISTRY));
        vm.stopBroadcast();

        console2.log("FhoxFactory deployed at:", address(factory));
        console2.log("  usdc:             ", DEPLOYED_USDC);
        console2.log("  identityRegistry: ", DEPLOYED_IDENTITY_REGISTRY);

        _writeDeployment(address(factory));
    }

    function _writeDeployment(address factory) internal {
        string memory path = "deployments/arbitrum-sepolia.json";
        string memory json = string.concat(
            "{\n",
            '  "chainId": 421614,\n',
            '  "factory": "',
            vm.toString(factory),
            '",\n',
            '  "usdc": "',
            vm.toString(DEPLOYED_USDC),
            '",\n',
            '  "identityRegistry": "',
            vm.toString(DEPLOYED_IDENTITY_REGISTRY),
            '"\n',
            "}\n"
        );
        vm.writeFile(path, json);
    }
}
