const { ethers, upgrades } = require("hardhat");

const ENTRY_FEE = ethers.parseEther("0.01");
const ROUND_DURATION = 3600;
const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

async function main() {
  const [owner, player1] = await ethers.getSigners();

  const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
  const mockVRF = await MockVRF.deploy();

  const Lottery3 = await ethers.getContractFactory("Lottery3");
  const lottery = await upgrades.deployProxy(Lottery3, [], { initializer: false, kind: "uups" });
  await lottery.initialize4();
  await lottery.updateCoordinator(await mockVRF.getAddress());
  await lottery.setTicketPrice(ENTRY_FEE);
  await lottery.setRoundDuration(ROUND_DURATION);
  await lottery.setCallbackGasLimit(500_000);
  await lottery.setRequestConfirmations(3);
  await lottery.setNumWords(7);
  await lottery.setKeyHash(ethers.ZeroHash);
  await lottery.setSubscriptionId(1);
  await lottery.startRound();

  await lottery.connect(player1).buyTicket([1, 2, 3, 4, 5, 6, 7], { value: ENTRY_FEE });

  await ethers.provider.send("evm_increaseTime", [ROUND_DURATION + 1]);
  await ethers.provider.send("evm_mine");

  const roundId = await lottery.currentRoundId();
  await lottery.performUpkeep(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
  );

  const requestId = await lottery.lastRequestId();
  await mockVRF.fulfillRandomWords(requestId, RANDOM_WORDS);

  const winning = await lottery.getRoundWinningNumbers(roundId);
  console.log("\n=== Winning numbers from RANDOM_WORDS [1,2,3,4,5,6,7] ===");
  console.log(winning.map(n => Number(n)));
}

main().catch(console.error);
