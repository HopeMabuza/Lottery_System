require("dotenv").config();
const { ethers } = require("hardhat");

// Reads and prints the current contract state — round info, pause status, fees, rollover pool
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  const roundId = await contract.currentRoundId();
  const round = await contract.rounds(roundId);
  const ticketCount = await contract.getRoundTicketCount(roundId);

  console.log("--- Contract State ---");
  console.log("Game Paused      :", await contract.paused());
  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Draw Requested   :", round.drawRequested);
  console.log("Round Drawn      :", round.drawn);
  console.log("Round End Time   :", new Date(Number(round.endTime) * 1000).toLocaleString());
  console.log("Tickets in Round :", ticketCount.toString());
  console.log("Entry Fee        :", ethers.formatEther(await contract.entryFee()), "ETH");
  console.log("Round Duration   :", (await contract.roundDuration()).toString(), "seconds");
  console.log("Rollover Pool    :", ethers.formatEther(await contract.rolloverPool()), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
