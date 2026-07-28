// npx hardhat run scripts/deploy.js --network sepolia

const { ethers, upgrades, hre } = require("hardhat");
const exportArtifacts = require("./exportArtifacts");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) throw new Error("Set USDC_ADDRESS in .env");

  console.log("Deploying Lottery...");
  console.log("Deployer:", deployer.getAddress());
  console.log("USDC:    ", usdcAddress);

  const Lottery = await ethers.getContractFactory("Lottery");
  const lottery = await upgrades.deployProxy(Lottery, [usdcAddress], {
    initializer: "initialize",
    kind: "uups",
  });

  await lottery.waitForDeployment();

  const proxyAddress = await lottery.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n✓ Lottery deployed");
  console.log("  Proxy address:          ", proxyAddress);
  console.log("  Implementation address: ", implementationAddress);
  console.log("\nNext steps:");
  console.log("  1. Add", proxyAddress, "as a consumer on vrf.chain.link");
  console.log("  2. Verify implementation on Etherscan:");
  console.log("     npx hardhat verify --network sepolia", implementationAddress);
  console.log("  3. Add LOTTERY_ADDRESS=" + proxyAddress, "to your .env");
  console.log("  4. Run: npx hardhat run scripts/interactive.js --network sepolia");

  await exportArtifacts(hre, proxyAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
