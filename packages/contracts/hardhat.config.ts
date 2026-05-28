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
    // Local FHE emulation (Hardhat + Fhenix mock coprocessor)
    hardhat: {},
    localfhenix: {
      url: "http://localhost:42069",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    // Fhenix Nitrogen Testnet
    fhenixNitrogen: {
      url: process.env.FHENIX_RPC_URL ?? "https://api.nitrogen.fhenix.zone",
      chainId: 8008148,
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
