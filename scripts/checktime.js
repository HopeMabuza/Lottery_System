require("dotenv").config();
const { ethers } = require("hardhat");

// Checks if the current round's endTime has passed on-chain vs local system time
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  const roundId = await contract.currentRoundId();
  const round = await contract.rounds(roundId);

  const endTime = round.endTime.toString();
  const nowSeconds = Math.floor(Date.now() / 1000);

  console.log("Raw endTime (unix) :", endTime);
  console.log("Now (unix)         :", nowSeconds);
  console.log("Diff (seconds)     :", Number(endTime) - nowSeconds);
  console.log("Round expired?     :", nowSeconds >= Number(endTime));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
