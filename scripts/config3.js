require("dotenv").config();
const { ethers } = require("hardhat");

// Post-upgrade config for Lottery3 — sets round duration to 5 minutes and pauses the game
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  // Set round duration to 5 minutes
  console.log("Setting round duration to 5 minutes...");
  const durationTx = await contract.setRoundDuration(300);
  await durationTx.wait();
  console.log("Round duration set to 300 seconds ");

  // Pause the game
  console.log("Pausing the game...");
  const pauseTx = await contract.pauseGame();
  await pauseTx.wait();
  console.log("Game paused ");

  // Print state
  const roundId = await contract.currentRoundId();
  const round = await contract.rounds(roundId);
  const ticketCount = await contract.getRoundTicketCount(roundId);

  console.log("\n--- Contract State ---");
  console.log("Entry Fee        :", ethers.formatEther(await contract.entryFee()), "ETH");
  console.log("Round Duration   :", (await contract.roundDuration()).toString(), "seconds");
  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Game Paused      :", await contract.paused());
  console.log("Tickets in Round :", ticketCount.toString());
  console.log("\n  Call unpauseGame() then startRound() when ready to resume.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
