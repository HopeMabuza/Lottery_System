require("dotenv").config();
const { ethers } = require("hardhat");

// Pauses the game, blocking ticket purchases and Chainlink Automation upkeep
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  // Confirm game is currently unpaused before proceeding
  const isPaused = await contract.paused();
  if (isPaused) {
    console.log("Game is already paused. Nothing to do.");
    return;
  }

  // Pause the game
  console.log("Pausing the game...");
  const pauseTx = await contract.pauseGame();
  await pauseTx.wait();
  console.log("Game paused ✅");

  const roundId = await contract.currentRoundId();
  const round = await contract.rounds(roundId);

  console.log("\n--- Contract State ---");
  console.log("Game Paused      :", await contract.paused());
  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Tickets in Round :", (await contract.getRoundTicketCount(roundId)).toString());
  console.log("\n⚠️  Run unpause.js when ready to resume the game.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
