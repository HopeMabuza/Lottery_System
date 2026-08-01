// backfill.js — one-time script to sync all past contract events into the database
// Run with: node indexing/backfill.js
// Safe to re-run — all queries use ON CONFLICT DO NOTHING

const { ethers } = require("ethers");
const db = require("../db");
const handlers = require("./eventHandlers");
require("dotenv").config({ path: `${__dirname}/../.env` });

const ABI = [
  "event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime, uint256 seededPot)",
  "event TicketBought(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8[7] numbers)",
  "event WinningNumbersGenerated(uint256 requestId, uint256 roundId, uint8[7] winningNumbers)",
  "event RoundSettled(uint256 indexed roundId, uint8[7] winningNumbers, uint256 ownerFee, uint256 rolloverAdded)",
  "event RoundSkipped(uint256 indexed roundId, uint256 rolloverAmount)",
  "event RewardAssigned(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8 matches, uint256 reward)",
  "event RewardWithdrawn(address indexed player, uint256 amount)",
];

// Events in the order they should be processed to avoid FK issues
const EVENT_NAMES = [
  "RoundStarted",
  "TicketBought",
  "WinningNumbersGenerated",
  "RoundSettled",
  "RoundSkipped",
  "RewardAssigned",
  "RewardWithdrawn",
];

const HANDLER_MAP = {
  RoundStarted:            handlers.onRoundStarted,
  TicketBought:            handlers.onTicketBought,
  WinningNumbersGenerated: handlers.onWinningNumbersGenerated,
  RoundSettled:            handlers.onRoundSettled,
  RoundSkipped:            handlers.onRoundSkipped,
  RewardAssigned:          handlers.onRewardAssigned,
  RewardWithdrawn:         handlers.onRewardWithdrawn,
};

async function main() {
  const rpcUrl = process.env.SEPOLIA_WSS_URL || process.env.SEPOLIA_RPC_URL;
  const contractAddress = process.env.LOTTERY_ADDRESS;

  if (!rpcUrl)          throw new Error("Set SEPOLIA_WSS_URL or SEPOLIA_RPC_URL in backend/.env");
  if (!contractAddress) throw new Error("Set LOTTERY_ADDRESS in backend/.env");

  const provider = new ethers.WebSocketProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Lottery Backfill");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Contract: ${contractAddress}\n`);

  // Collect all events across all types, sorted by block + log index
  const allEvents = [];

  for (const name of EVENT_NAMES) {
    process.stdout.write(`  Fetching ${name} events...`);
    const filter = contract.filters[name]();
    const events = await contract.queryFilter(filter);
    console.log(` ${events.length} found`);
    for (const e of events) {
      allEvents.push({ name, event: e });
    }
  }

  // Sort by block number then log index so events are replayed in the right order
  allEvents.sort((a, b) => {
    const blockDiff = a.event.blockNumber - b.event.blockNumber;
    return blockDiff !== 0 ? blockDiff : a.event.index - b.event.index;
  });

  console.log(`\n  Processing ${allEvents.length} events...\n`);

  let saved = 0;
  for (const { name, event } of allEvents) {
    try {
      const handler = HANDLER_MAP[name];
      await handler(...event.args, event);
      saved++;
    } catch (err) {
      console.error(`  [SKIP] ${name} at block ${event.blockNumber}: ${err.message}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Done. ${saved} / ${allEvents.length} events saved.`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await provider.destroy();
  await db.end();
}

main().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});
