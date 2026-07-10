require("dotenv").config();
const { ethers, upgrades } = require("hardhat");

// Deploys the initial UUPS proxy with WinningNumbers as the first implementation
async function main() {
  const vrfCoordinator = process.env.VRF_COORDINATOR;
  const subscriptionId = process.env.SUBSCRIPTION_ID;
  const keyHash = process.env.KEY_HASH;

  console.log("Deploying proxy contract...");

  const WinningNumbers = await ethers.getContractFactory("WinningNumbers");

  const proxy = await upgrades.deployProxy(
    WinningNumbers,
    [vrfCoordinator, subscriptionId, keyHash],
    { initializer: "initialize", kind: "uups" }
  );

  await proxy.waitForDeployment();

  const Proxyaddress = await proxy.getAddress();

  console.log("Proxy deployed to:", Proxyaddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});