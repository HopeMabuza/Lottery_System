// queries.js — all database write logic for the indexer
// Each function saves one type of event data to the database

const db = require("../db");

// Converts unix timestamp to JS Date
function toDate(unixSeconds) {
  return new Date(Number(unixSeconds) * 1000);
}

// Converts USDC from 6 decimals to readable number
function fromUsdc(amount) {
  return (Number(amount) / 1_000_000).toFixed(6);
}

// Creates a new round row when a round starts.
// Uses ON CONFLICT so re-running the indexer won't create duplicates.
async function saveRoundStarted(roundId, startTime, endTime, seededPot) {
  await db.query(
    `INSERT INTO rounds (id, active, start_time, end_time, pot)
     VALUES ($1, true, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET active = true, start_time = $2, end_time = $3, pot = $4`,
    [roundId.toString(), toDate(startTime), toDate(endTime), fromUsdc(seededPot)]
  );
}

// Saves a new ticket to the tickets table.
// ON CONFLICT DO NOTHING prevents duplicates if the indexer replays old events.
async function saveTicketBought(roundId, player, ticketIndex, numbers) {
  await db.query(
    `INSERT INTO tickets (round_id, ticket_index, player_address, numbers)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [roundId.toString(), ticketIndex.toString(), player.toLowerCase(), numbers.map(Number)]
  );
}

// Updates the round row with the winning numbers once VRF responds.
// Also marks draw_requested = true so we know the draw has been triggered.
async function saveWinningNumbers(roundId, winningNumbers) {
  await db.query(
    `UPDATE rounds SET winning_numbers = $1, draw_requested = true WHERE id = $2`,
    [winningNumbers.map(Number), roundId.toString()]
  );
}

// Prize tier percentages — must match the contract constants exactly.
// Index = number of matches (0–7). Values are percentages of the prize pool.
const TIER_PERCENTS = [0, 0, 0, 5, 10, 15, 30, 40];

// Counts how many numbers in `ticket` appear anywhere in `winning` (set intersection).
function countMatches(ticketNumbers, winningNumbers) {
  const winSet = new Set(winningNumbers.map(Number));
  return ticketNumbers.map(Number).filter((n) => winSet.has(n)).length;
}

// Called after WinningNumbersGenerated — calculates every ticket's match count and
// reward off-chain, then writes results to the DB.
// Mirrors _settleRound() from the contract but runs in the backend instead of on-chain.
async function settleRoundOffChain(roundId, winningNumbers) {
  const roundIdStr = roundId.toString();

  // Load all tickets for this round
  const { rows: tickets } = await db.query(
    `SELECT ticket_index, numbers FROM tickets WHERE round_id = $1`,
    [roundIdStr]
  );

  if (tickets.length === 0) return;

  // Load the pot for this round
  const { rows: roundRows } = await db.query(
    `SELECT pot FROM rounds WHERE id = $1`,
    [roundIdStr]
  );
  if (roundRows.length === 0) return;

  const pot = parseFloat(roundRows[0].pot);
  // 10% owner fee, rest is prize pool
  const prizePool = pot * 0.9;

  // Count winners per tier
  const winnersPerTier = new Array(8).fill(0);
  const ticketMatches = tickets.map((t) => {
    const matches = countMatches(t.numbers, winningNumbers);
    winnersPerTier[matches]++;
    return { ticket_index: t.ticket_index, matches };
  });

  // Calculate reward per winner in each tier
  const rewardPerWinner = TIER_PERCENTS.map((pct, tier) => {
    if (winnersPerTier[tier] === 0) return 0;
    return (prizePool * pct) / 100 / winnersPerTier[tier];
  });

  // Write match count and reward to each ticket row
  for (const { ticket_index, matches } of ticketMatches) {
    const reward = rewardPerWinner[matches];
    await db.query(
      `UPDATE tickets SET matched_count = $1, reward = $2
       WHERE round_id = $3 AND ticket_index = $4`,
      [matches, reward.toFixed(6), roundIdStr, ticket_index.toString()]
    );
  }

  console.log(`[OffChainSettle] Round #${roundId} — ${tickets.length} tickets processed`);
}

// Marks a round as settled — stores final winning numbers, owner fee, and rollover amount.
async function saveRoundSettled(roundId, winningNumbers, ownerFee, rolloverAdded) {
  await db.query(
    `UPDATE rounds
     SET drawn = true, active = false, winning_numbers = $1, owner_fee = $2, rollover_added = $3
     WHERE id = $4`,
    [
      winningNumbers.map(Number),
      fromUsdc(ownerFee),
      fromUsdc(rolloverAdded),
      roundId.toString(),
    ]
  );
}

// Marks a round as skipped — happens when a round expires with zero tickets.
async function saveRoundSkipped(roundId) {
  await db.query(
    `UPDATE rounds SET drawn = true, active = false WHERE id = $1`,
    [roundId.toString()]
  );
}

// Updates a ticket row with how many numbers matched and the reward amount.
// Used when replaying on-chain RewardAssigned events (backfill).
async function saveRewardAssigned(roundId, ticketIndex, matches, reward) {
  await db.query(
    `UPDATE tickets SET matched_count = $1, reward = $2
     WHERE round_id = $3 AND ticket_index = $4`,
    [Number(matches), fromUsdc(reward), roundId.toString(), ticketIndex.toString()]
  );
}

// Saves a withdrawal record when a player claims their reward.
// ON CONFLICT on tx_hash prevents saving the same withdrawal twice.
async function saveWithdrawal(player, amount, txHash) {
  await db.query(
    `INSERT INTO withdrawals (player_address, amount, tx_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [player.toLowerCase(), fromUsdc(amount), txHash]
  );
}

// Logs every raw event to events_log for debugging and replaying.
async function saveEventLog(eventName, blockNumber, txHash, data) {
  await db.query(
    `INSERT INTO events_log (event_name, block_number, tx_hash, data)
     VALUES ($1, $2, $3, $4)`,
    [eventName, blockNumber, txHash, JSON.stringify(data)]
  );
}

module.exports = {
  saveRoundStarted,
  saveTicketBought,
  saveWinningNumbers,
  settleRoundOffChain,
  saveRoundSettled,
  saveRoundSkipped,
  saveRewardAssigned,
  saveWithdrawal,
  saveEventLog,
};
