require("dotenv").config();
const { ethers } = require("hardhat");

// Manually triggers performUpkeep to force-close an expired round when Automation is not responding
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  const roundId = await contract.currentRoundId();
  const round = await contract.rounds(roundId);

  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Round Expired    :", Math.floor(Date.now() / 1000) >= Number(round.endTime.toString()));
  console.log("Tickets in Round :", (await contract.getRoundTicketCount(roundId)).toString());

  // Encode the roundId as performData (matches what checkUpkeep returns)
  const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId]);

  console.log("\nTriggering performUpkeep...");
  const tx = await contract.performUpkeep(performData, { gasLimit: 500000 });
  await tx.wait();
  console.log("performUpkeep executed ✅");

  const newRoundId = await contract.currentRoundId();
  const newRound = await contract.rounds(newRoundId);

  console.log("\n--- New Round State ---");
  console.log("Current Round ID :", newRoundId.toString());
  console.log("Round Active     :", newRound.active);
  console.log("Round End Time   :", new Date(Number(newRound.endTime.toString()) * 1000).toLocaleString());
  console.log("Round Duration   :", (await contract.roundDuration()).toString(), "seconds");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
