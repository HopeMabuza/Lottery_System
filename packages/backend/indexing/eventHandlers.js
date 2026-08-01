// eventHandlers.js — one function per contract event
// Each handler logs what happened and calls the right query to save it

const queries = require("./queries");

// Fires when a new lottery round opens.
// Saves the round details and logs the event.
async function onRoundStarted(roundId, startTime, endTime, seededPot, event) {
  console.log(`[RoundStarted] Round #${roundId}`);
  await queries.saveRoundStarted(roundId, startTime, endTime, seededPot);
  await queries.saveEventLog("RoundStarted", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
  });
}

// Fires when a player buys a ticket.
// Saves the ticket with the player's address and chosen numbers.
async function onTicketBought(roundId, player, ticketIndex, numbers, event) {
  console.log(`[TicketBought] Round #${roundId} — ${player} — [${numbers.join(", ")}]`);
  await queries.saveTicketBought(roundId, player, ticketIndex, numbers);
  await queries.saveEventLog("TicketBought", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
    player,
    numbers: numbers.map(Number),
  });
}

// Fires when Chainlink VRF delivers the random numbers.
// Saves the winning numbers, then calculates every ticket's match count and reward off-chain.
async function onWinningNumbersGenerated(requestId, roundId, winningNumbers, event) {
  console.log(`[WinningNumbersGenerated] Round #${roundId} — [${winningNumbers.join(", ")}]`);
  await queries.saveWinningNumbers(roundId, winningNumbers);
  await queries.settleRoundOffChain(roundId, winningNumbers);
  await queries.saveEventLog("WinningNumbersGenerated", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
    winningNumbers: winningNumbers.map(Number),
  });
}

// Fires when the owner settles the round.
// Marks the round as done and saves the final financial breakdown.
async function onRoundSettled(roundId, winningNumbers, ownerFee, rolloverAdded, event) {
  console.log(`[RoundSettled] Round #${roundId}`);
  await queries.saveRoundSettled(roundId, winningNumbers, ownerFee, rolloverAdded);
  await queries.saveEventLog("RoundSettled", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
  });
}

// Fires when a round expires with no tickets.
// Marks the round as skipped so the history stays complete.
async function onRoundSkipped(roundId, rolloverAmount, event) {
  console.log(`[RoundSkipped] Round #${roundId}`);
  await queries.saveRoundSkipped(roundId);
  await queries.saveEventLog("RoundSkipped", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
  });
}

// Fires when a winning ticket is assigned its reward.
// Updates the ticket row with the match count and reward amount.
async function onRewardAssigned(roundId, player, ticketIndex, matches, reward, event) {
  console.log(`[RewardAssigned] Round #${roundId} — ${player}`);
  await queries.saveRewardAssigned(roundId, ticketIndex, matches, reward);
  await queries.saveEventLog("RewardAssigned", event.log.blockNumber, event.log.transactionHash, {
    roundId: roundId.toString(),
    player,
    matches: Number(matches),
  });
}

// Fires when a player withdraws their USDC reward.
// Saves the withdrawal record with the transaction hash.
async function onRewardWithdrawn(player, amount, event) {
  console.log(`[RewardWithdrawn] ${player}`);
  await queries.saveWithdrawal(player, amount, event.log.transactionHash);
  await queries.saveEventLog("RewardWithdrawn", event.log.blockNumber, event.log.transactionHash, {
    player,
  });
}

module.exports = {
  onRoundStarted,
  onTicketBought,
  onWinningNumbersGenerated,
  onRoundSettled,
  onRoundSkipped,
  onRewardAssigned,
  onRewardWithdrawn,
};
