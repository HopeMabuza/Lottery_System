require("dotenv").config();
const { ethers, upgrades } = require("hardhat");

// Upgrades the proxy to Lottery3 implementation and calls initialize4
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;

  console.log("Upgrading proxy to Lottery3...");

  const Lottery3 = await ethers.getContractFactory("Lottery3");

  const upgraded = await upgrades.upgradeProxy(proxyAddress, Lottery3, {
    call: { fn: "initialize4" },
    kind: "uups",
  });

  await upgraded.waitForDeployment();
  console.log("Proxy upgraded to Lottery3 at:", proxyAddress);

  const contract = await ethers.getContractAt("Lottery3", proxyAddress);

  // Confirm pause state is correctly set after upgrade
  const isPaused = await contract.paused();
  console.log("Game Paused      :", isPaused);

  // Set round duration to 5 minutes (300 seconds)
  console.log("Setting round duration to 5 minutes...");
  const durationTx = await contract.setRoundDuration(300);
  await durationTx.wait();
  console.log("Round duration set to 300 seconds ");

  let roundId = await contract.currentRoundId();
  let round = await contract.rounds(roundId);

  if (!round.active) {
    console.log("No active round found. Starting first round...");
    const tx = await contract.startRound({ gasLimit: 300000 });
    await tx.wait();
    console.log("Round started ");
    roundId = await contract.currentRoundId();
    round = await contract.rounds(roundId);
  }

  const ticketCount = await contract.getRoundTicketCount(roundId);

  console.log("\n--- Contract State ---");
  console.log("Entry Fee        :", ethers.formatEther(await contract.entryFee()), "ETH");
  console.log("Round Duration   :", (await contract.roundDuration()).toString(), "seconds");
  console.log("Current Round ID :", roundId.toString());
  console.log("Round Active     :", round.active);
  console.log("Round End Time   :", new Date(Number(round.endTime) * 1000).toLocaleString());
  console.log("Tickets in Round :", ticketCount.toString());

  if (ticketCount == 0) {
    console.log("\n No players in this round — round will be skipped and pot rolled over.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
