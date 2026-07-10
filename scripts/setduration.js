require("dotenv").config();
const { ethers } = require("hardhat");

// Updates the round duration — edit NEW_DURATION_SECONDS before running
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  // --- CONFIGURE HERE ---
  const NEW_DURATION_SECONDS = 300; // change this value as needed
  // ----------------------

  // Common values:
  // 5 minutes  = 300
  // 10 minutes = 600
  // 30 minutes = 1800
  // 1 hour     = 3600
  // 6 hours    = 21600
  // 12 hours   = 43200
  // 24 hours   = 86400

  const currentDuration = await contract.roundDuration();
  console.log("Current Duration :", currentDuration.toString(), "seconds");

  console.log(`Setting round duration to ${NEW_DURATION_SECONDS} seconds...`);
  const tx = await contract.setRoundDuration(NEW_DURATION_SECONDS);
  await tx.wait();
  console.log("Round duration updated ✅");

  console.log("New Duration     :", (await contract.roundDuration()).toString(), "seconds");
  console.log("\n⚠️  This only affects future rounds. The current active round endTime is unchanged.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
