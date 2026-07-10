require("dotenv").config();
const { ethers } = require("hardhat");

// Compares Sepolia block.timestamp against local system clock to check for time drift
async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const block = await provider.getBlock("latest");

  const blockTime = block.timestamp;
  const localTime = Math.floor(Date.now() / 1000);

  console.log("Sepolia block timestamp :", blockTime);
  console.log("Sepolia block time (UTC):", new Date(blockTime * 1000).toUTCString());
  console.log("Local system time (unix):", localTime);
  console.log("Local system time (UTC) :", new Date(localTime * 1000).toUTCString());
  console.log("Difference (seconds)    :", localTime - blockTime);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
