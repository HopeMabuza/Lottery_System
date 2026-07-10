require("dotenv").config();
const { ethers, upgrades } = require("hardhat");

// Upgrades the proxy to Lottery2 implementation and calls initialize3
async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;

  console.log("Upgrading proxy to Lottery2...");

  const Lottery2 = await ethers.getContractFactory("Lottery2");

  const upgraded = await upgrades.upgradeProxy(proxyAddress, Lottery2, {
    call: { fn: "initialize3" },
    kind: "uups",
  });

  await upgraded.waitForDeployment();
  console.log("Proxy upgraded to Lottery2 at:", proxyAddress);

  const contract = await ethers.getContractAt("Lottery2", proxyAddress);

  let roundId = await contract.currentRoundId();
  let round = await contract.rounds(roundId);

  if (!round.active) {
    console.log("Starting first round...");
    const tx = await contract.startRound({ gasLimit: 300000 });
    await tx.wait();
    console.log("Round started ✅");
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
    console.log("\n⚠️  No players in this round — round will be skipped and pot rolled over.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
