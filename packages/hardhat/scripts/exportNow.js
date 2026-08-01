// exportNow.js — one-time script to export current deployment artifacts to frontend
// Run with: npx hardhat run scripts/exportNow.js --network sepolia

const exportArtifacts = require("./exportArtifacts");
require("dotenv").config();

async function main() {
  const proxyAddress = process.env.LOTTERY_ADDRESS;
  if (!proxyAddress) throw new Error("Set LOTTERY_ADDRESS in .env");
  await exportArtifacts(hre, proxyAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
