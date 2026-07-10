require("dotenv").config();
const { ethers } = require("hardhat");

// Unpauses the game and starts a new round if none is currently active
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  // Confirm game is currently paused before proceeding
  const isPaused = await contract.paused();
  if (!isPaused) {
    console.log("Game is not paused. Nothing to do.");
    return;
  }

  // Unpause the game
  console.log("Unpausing the game...");
  const unpauseTx = await contract.unpauseGame();
  await unpauseTx.wait();
  console.log("Game unpaused ✅");

  // Only start a new round if one isn't already active
  let roundId = await contract.currentRoundId();
  let round = await contract.rounds(roundId);

  if (!round.active) {
    console.log("Starting new round...");
    const roundTx = await contract.startRound({ gasLimit: 300000 });
    await roundTx.wait();
    console.log("Round started ✅");
    roundId = await contract.currentRoundId();
    round = await contract.rounds(roundId);
  } else {
    console.log("Round already active, skipping startRound.");
  }

  console.log("\n--- Contract State ---");
  console.log("Game Paused      :", await contract.paused());
  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Round End Time   :", new Date(Number(round.endTime) * 1000).toLocaleString());
  console.log("Entry Fee        :", ethers.formatEther(await contract.entryFee()), "ETH");
  console.log("Round Duration   :", (await contract.roundDuration()).toString(), "seconds");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
