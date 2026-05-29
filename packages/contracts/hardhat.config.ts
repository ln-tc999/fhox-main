import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@cofhe/hardhat-plugin";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun" },
      },
      {
        version: "0.8.25",
        settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun" },
      },
    ],
  },
  networks: {
    hardhat: {},
    localfhenix: {
      url: "http://localhost:42069",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    arbSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    ethSepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia.publicnode.com",
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./src",
    tests: "./test-hardhat",
    cache: "./cache-hardhat",
    artifacts: "./artifacts",
  },
};

export default config;
