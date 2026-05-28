import { ethers } from "hardhat";
import { FhenixClient } from "@cofhe/sdk";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy mock USDC (replace with real address on production)
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // Deploy mock IdentityRegistry (replace with real ERC-8004 on Arc/mainnet)
  const MockIdentityRegistry = await ethers.getContractFactory("MockIdentityRegistry");
  const identityRegistry = await MockIdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  console.log("MockIdentityRegistry:", await identityRegistry.getAddress());

  // Deploy FhoxFactory
  const FhoxFactory = await ethers.getContractFactory("FhoxFactory");
  const factory = await FhoxFactory.deploy(
    await usdc.getAddress(),
    await identityRegistry.getAddress()
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("FhoxFactory:", factoryAddress);

  // Write deployment addresses
  const deployments = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    factory: factoryAddress,
    usdc: await usdc.getAddress(),
    identityRegistry: await identityRegistry.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  const fs = await import("fs");
  fs.writeFileSync(
    "deployments/fhenix-nitrogen.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("Deployment written to deployments/fhenix-nitrogen.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
