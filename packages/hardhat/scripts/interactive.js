// Usage: npx hardhat run scripts/interactive.js --network <network>
// Set LOTTERY_ADDRESS in your .env file
//
// What this script does:
//  - Connects to the deployed Lottery contract using LOTTERY_ADDRESS from .env
//  - Uses signer[0] (PRIVATE_KEY) as the owner and signer[1] (PLAYER1_PRIVATE_KEY) as the player
//  - Option 1:  Shows current round status (pot, tickets, time remaining, draw state)
//  - Option 2:  Buys a ticket as the player — approves USDC spend and submits 7 numbers
//  - Option 3:  Shows the player's pending USDC reward
//  - Option 4:  Withdraws the player's USDC reward to their wallet
//  - Option 5:  Settles the current round as owner (assigns rewards, starts next round)
//  - Option 6:  Manually starts a new round as owner
//  - Option 7:  Pauses or unpauses the game as owner
//  - Option 8:  Withdraws accrued owner fees in USDC
//  - Option 9:  Lists all tickets for a given round with match counts and rewards
//  - Option 10: Manually triggers the draw (replaces Chainlink Automation on testnet)

const { ethers } = require("hardhat");
const readline = require("readline");
require("dotenv").config();

const LOTTERY4_ABI = [
  "function currentRoundId() view returns (uint256)",
  "function rounds(uint256) view returns (bool active, bool drawRequested, bool drawn, uint256 startTime, uint256 endTime, uint256 pot)",
  "function entryFee() view returns (uint256)",
  "function paused() view returns (bool)",
  "function pendingRewards(address) view returns (uint256)",
  "function ownerFeesAccrued() view returns (uint256)",
  "function rolloverPool() view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function getRoundTicketCount(uint256) view returns (uint256)",
  "function getRoundWinningNumbers(uint256) view returns (uint8[7])",
  "function getTicket(uint256, uint256) view returns (address player, uint8[7] numbers, uint8 matchedCount, uint256 reward)",
  "function buyTicket(uint8[7] calldata numbers)",
  "function withdrawReward()",
  "function settleRound(uint256 roundId)",
  "function startRound()",
  "function pauseGame()",
  "function unpauseGame()",
  "function withdrawOwnerFees()",
  "function setTicketPrice(uint256)",
  "function setRoundDuration(uint256)",
  "function performUpkeep(bytes calldata)",
  "function checkUpkeep(bytes calldata) view returns (bool upkeepNeeded, bytes memory performData)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

function formatUsdc(amount) {
  return (Number(amount) / 1_000_000).toFixed(2) + " USDC";
}

function formatTime(ts) {
  return new Date(Number(ts) * 1000).toLocaleString();
}

async function printStatus(lottery) {
  const roundId = await lottery.currentRoundId();
  const round = await lottery.rounds(roundId);
  const ticketCount = await lottery.getRoundTicketCount(roundId);
  const fee = await lottery.entryFee();
  const isPaused = await lottery.paused();
  const rollover = await lottery.rolloverPool();

  console.log("\n─────────────────────────────────────");
  console.log(`  Round:       #${roundId}`);
  console.log(`  Status:      ${isPaused ? "PAUSED" : round.active ? "Open" : "Closed"}`);
  console.log(`  Draw req:    ${round.drawRequested ? "Yes" : "No"}`);
  console.log(`  Settled:     ${round.drawn ? "Yes" : "No"}`);
  console.log(`  Ends:        ${formatTime(round.endTime)}`);
  console.log(`  Pot:         ${formatUsdc(round.pot)}`);
  console.log(`  Rollover:    ${formatUsdc(rollover)}`);
  console.log(`  Tickets:     ${ticketCount}`);
  console.log(`  Entry fee:   ${formatUsdc(fee)}`);
  console.log("─────────────────────────────────────\n");
}

async function main() {
  const contractAddress = process.env.LOTTERY_ADDRESS;
  if (!contractAddress) {
    console.error("Set LOTTERY_ADDRESS in your .env file");
    process.exit(1);
  }

  const signers = await ethers.getSigners();
  const owner = signers[0];
  const player = signers[1] || signers[0];

  const lottery = new ethers.Contract(contractAddress, LOTTERY4_ABI, owner);
  const tokenAddress = await lottery.paymentToken();
  const usdc = new ethers.Contract(tokenAddress, ERC20_ABI, player);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     Lottery4 Interactive Script      ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`  Contract:  ${contractAddress}`);
  console.log(`  Owner:     ${owner.address}`);
  console.log(`  Player:    ${player.address}`);
  console.log(`  USDC:      ${tokenAddress}`);

  while (true) {
    console.log("\n  1. Round status");
    console.log("  2. Buy ticket");
    console.log("  3. My pending reward");
    console.log("  4. Withdraw reward");
    console.log("  5. Settle round (owner)");
    console.log("  6. Start new round (owner)");
    console.log("  7. Pause / Unpause (owner)");
    console.log("  8. Withdraw owner fees");
    console.log("  9. View tickets for round");
    console.log(" 10. Trigger draw manually (performUpkeep)");
    console.log("  0. Exit\n");

    const choice = (await ask("  Choice: ")).trim();

    if (choice === "0") {
      console.log("\nBye!\n");
      rl.close();
      break;
    }

    if (choice === "1") {
      await printStatus(lottery);
    }

    else if (choice === "2") {
      const input = await ask("  Enter 7 numbers (1-49, space separated): ");
      const numbers = input.trim().split(/\s+/).map(Number);

      if (numbers.length !== 7) {
        console.log("  Need exactly 7 numbers.");
        continue;
      }

      const fee = await lottery.entryFee();
      const allowance = await usdc.allowance(player.address, contractAddress);

      if (allowance < fee) {
        console.log(`  Approving ${formatUsdc(fee)} USDC...`);
        const approveTx = await usdc.approve(contractAddress, fee);
        await approveTx.wait();
        console.log("  Approved.");
      }

      console.log(`  Buying ticket with [${numbers.join(", ")}]...`);
      const tx = await lottery.connect(player).buyTicket(numbers);
      const receipt = await tx.wait();
      console.log(`  Done. Tx: ${receipt.hash}`);
    }

    else if (choice === "3") {
      const reward = await lottery.pendingRewards(player.address);
      console.log(`\n  Pending reward: ${formatUsdc(reward)}`);
    }

    else if (choice === "4") {
      const reward = await lottery.pendingRewards(player.address);
      if (reward === 0n) {
        console.log("  No reward to withdraw.");
        continue;
      }
      console.log(`  Withdrawing ${formatUsdc(reward)}...`);
      const tx = await lottery.connect(player).withdrawReward();
      const receipt = await tx.wait();
      console.log(`  Done. Tx: ${receipt.hash}`);
    }

    else if (choice === "5") {
      const roundIdInput = await ask("  Round ID to settle (leave blank for current): ");
      const roundId = roundIdInput.trim() === ""
        ? await lottery.currentRoundId()
        : BigInt(roundIdInput.trim());
      const confirm = await ask(`  Settle round #${roundId}? (y/n): `);
      if (confirm.toLowerCase() !== "y") continue;
      const tx = await lottery.settleRound(roundId);
      const receipt = await tx.wait();
      console.log(`  Round #${roundId} settled. Tx: ${receipt.hash}`);
    }

    else if (choice === "6") {
      const confirm = await ask("  Start a new round? (y/n): ");
      if (confirm.toLowerCase() !== "y") continue;
      const tx = await lottery.startRound();
      const receipt = await tx.wait();
      console.log(`  New round started. Tx: ${receipt.hash}`);
    }

    else if (choice === "7") {
      const isPaused = await lottery.paused();
      const action = isPaused ? "Unpause" : "Pause";
      const confirm = await ask(`  ${action} the game? (y/n): `);
      if (confirm.toLowerCase() !== "y") continue;
      const tx = isPaused ? await lottery.unpauseGame() : await lottery.pauseGame();
      const receipt = await tx.wait();
      console.log(`  Game ${isPaused ? "unpaused" : "paused"}. Tx: ${receipt.hash}`);
    }

    else if (choice === "8") {
      const fees = await lottery.ownerFeesAccrued();
      if (fees === 0n) {
        console.log("  No fees to withdraw.");
        continue;
      }
      console.log(`  Withdrawing ${formatUsdc(fees)} in owner fees...`);
      const tx = await lottery.withdrawOwnerFees();
      const receipt = await tx.wait();
      console.log(`  Done. Tx: ${receipt.hash}`);
    }

    else if (choice === "9") {
      const roundIdInput = await ask("  Round ID (leave blank for current): ");
      const roundId = roundIdInput.trim() === ""
        ? await lottery.currentRoundId()
        : BigInt(roundIdInput.trim());

      const count = await lottery.getRoundTicketCount(roundId);
      const winning = await lottery.getRoundWinningNumbers(roundId);
      const winningStr = winning.map(Number).join(", ");

      console.log(`\n  Round #${roundId} — ${count} ticket(s)`);
      console.log(`  Winning numbers: [${winningStr}]`);

      for (let i = 0; i < count; i++) {
        const [ticketPlayer, numbers, matchedCount, reward] = await lottery.getTicket(roundId, i);
        console.log(`  [${i}] ${ticketPlayer} | [${numbers.map(Number).join(", ")}] | matches: ${matchedCount} | reward: ${formatUsdc(reward)}`);
      }
    }

    else if (choice === "10") {
      const roundId = await lottery.currentRoundId();
      const [upkeepNeeded] = await lottery.checkUpkeep("0x");

      if (!upkeepNeeded) {
        console.log("  Upkeep not needed yet — round has not expired.");
        continue;
      }

      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId]);
      const tx = await lottery.performUpkeep(performData);
      await tx.wait();
      console.log(`  Draw triggered for round #${roundId}. Waiting for Chainlink VRF...`);
      console.log("  Once VRF responds, call option 5 (settleRound) to complete settlement.");
    }

    else {
      console.log("  Invalid choice.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
