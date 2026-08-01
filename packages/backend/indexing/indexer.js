// indexer.js — entry point for the event indexer
// Connects to Sepolia via WebSocket and registers all event listeners
// Run with: node indexing/indexer.js

const { ethers } = require("ethers");
const db = require("../db");
const handlers = require("./eventHandlers");
require("dotenv").config({ path: "../.env" });

const ABI = [
  "event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime, uint256 seededPot)",
  "event TicketBought(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8[7] numbers)",
  "event WinningNumbersGenerated(uint256 requestId, uint256 roundId, uint8[7] winningNumbers)",
  "event RoundSettled(uint256 indexed roundId, uint8[7] winningNumbers, uint256 ownerFee, uint256 rolloverAdded)",
  "event RoundSkipped(uint256 indexed roundId, uint256 rolloverAmount)",
  "event RewardAssigned(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8 matches, uint256 reward)",
  "event RewardWithdrawn(address indexed player, uint256 amount)",
];

async function main() {
  const wssUrl = process.env.SEPOLIA_WSS_URL;
  const contractAddress = process.env.LOTTERY_ADDRESS;

  if (!wssUrl) throw new Error("Set SEPOLIA_WSS_URL in backend/.env");
  if (!contractAddress) throw new Error("Set LOTTERY_ADDRESS in backend/.env");

  const provider = new ethers.WebSocketProvider(wssUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Lottery Indexer");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Contract: ${contractAddress}`);
  console.log("  Listening for events...\n");

  contract.on("RoundStarted",            handlers.onRoundStarted);
  contract.on("TicketBought",            handlers.onTicketBought);
  contract.on("WinningNumbersGenerated", handlers.onWinningNumbersGenerated);
  contract.on("RoundSettled",            handlers.onRoundSettled);
  contract.on("RoundSkipped",            handlers.onRoundSkipped);
  contract.on("RewardAssigned",          handlers.onRewardAssigned);
  contract.on("RewardWithdrawn",         handlers.onRewardWithdrawn);

  // Graceful shutdown on Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\nShutting down indexer...");
    await provider.destroy();
    await db.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Indexer error:", err);
  process.exit(1);
});
