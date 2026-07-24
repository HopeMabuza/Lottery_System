// Run this after deploy.js, before registering Chainlink Automation
// npx hardhat run scripts/configure.js --network sepolia

const { ethers } = require("hardhat");
require("dotenv").config();

const LOTTERY_ABI = [
  "function setSubscriptionId(uint256)",
  "function setKeyHash(bytes32)",
  "function setCallbackGasLimit(uint32)",
  "function setRequestConfirmations(uint16)",
  "function setNumWords(uint32)",
  "function setTicketPrice(uint256)",
  "function setRoundDuration(uint256)",
  "function updateCoordinator(address)",
  "function startRound()",
  "function entryFee() view returns (uint256)",
  "function roundDuration() view returns (uint256)",
  "function subscriptionId() view returns (uint256)",
  "function currentRoundId() view returns (uint256)",
];

// Sepolia Chainlink config
const VRF_COORDINATOR  = ethers.getAddress("0x9ddfaca8183c41ad55329bdeed9f6a8d53168b1b");
const KEY_HASH         = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";
const CALLBACK_GAS     = 500_000;
const CONFIRMATIONS    = 3;
const NUM_WORDS        = 7;

// Game config — adjust as needed
const TICKET_PRICE     = 5_000_000n;   // 1 USDC (6 decimals)
const ROUND_DURATION   = 300;          // 5 minutes in seconds

async function main() {
  const contractAddress = process.env.LOTTERY_ADDRESS;
  const subscriptionId  = process.env.SUBSCRIPTION_ID;

  if (!contractAddress)  throw new Error("Set LOTTERY_ADDRESS in .env");
  if (!subscriptionId)   throw new Error("Set SUBSCRIPTION_ID in .env");

  const [owner] = await ethers.getSigners();
  const lottery = new ethers.Contract(contractAddress, LOTTERY_ABI, owner);

  console.log("Configuring Lottery at", contractAddress);
  console.log("Owner:", owner.address);
  console.log("");

  let tx;

  tx = await lottery.updateCoordinator(VRF_COORDINATOR);
  await tx.wait();
  console.log("✓ VRF Coordinator set");

  tx = await lottery.setSubscriptionId(subscriptionId);
  await tx.wait();
  console.log("✓ Subscription ID set:", subscriptionId);

  tx = await lottery.setKeyHash(KEY_HASH);
  await tx.wait();
  console.log("✓ Key hash set");

  tx = await lottery.setCallbackGasLimit(CALLBACK_GAS);
  await tx.wait();
  console.log("✓ Callback gas limit set:", CALLBACK_GAS);

  tx = await lottery.setRequestConfirmations(CONFIRMATIONS);
  await tx.wait();
  console.log("✓ Request confirmations set:", CONFIRMATIONS);

  tx = await lottery.setNumWords(NUM_WORDS);
  await tx.wait();
  console.log("✓ Num words set:", NUM_WORDS);

  tx = await lottery.setTicketPrice(TICKET_PRICE);
  await tx.wait();
  console.log("✓ Ticket price set: 1 USDC");

  tx = await lottery.setRoundDuration(ROUND_DURATION);
  await tx.wait();
  console.log("✓ Round duration set: 1 hour");

  tx = await lottery.startRound();
  await tx.wait();
  console.log("✓ Round 1 started");

  console.log("\n✓ Contract is ready");
  console.log("  You can now register", contractAddress, "on automation.chain.link");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
