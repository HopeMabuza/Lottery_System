const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// 1 USDC = 1_000_000 (6 decimals)
const ENTRY_FEE    = 1_000_000n;   // 1 USDC
const ROUND_DURATION = 3600;       // 1 hour

// Sepolia USDC — used only as a reference; tests use MockUSDC
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

describe("Lottery4", function () {
  let lottery;
  let mockVRF;
  let mockUSDC;
  let owner;
  let player1;
  let player2;
  let player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy mock VRF coordinator
    const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
    mockVRF = await MockVRF.deploy();

    // Deploy mock USDC and mint tokens to each player
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    const PLAYER_BALANCE = 1_000_000_000n; // 1000 USDC each
    await mockUSDC.mint(player1.address, PLAYER_BALANCE);
    await mockUSDC.mint(player2.address, PLAYER_BALANCE);
    await mockUSDC.mint(player3.address, PLAYER_BALANCE);

    // Deploy Lottery4 proxy
    const Lottery4 = await ethers.getContractFactory("Lottery4");
    lottery = await upgrades.deployProxy(Lottery4, [await mockUSDC.getAddress()], {
      initializer: "initialize",
      kind: "uups",
    });

    // Configure
    await lottery.updateCoordinator(await mockVRF.getAddress());
    await lottery.setTicketPrice(ENTRY_FEE);
    await lottery.setRoundDuration(ROUND_DURATION);
    await lottery.setCallbackGasLimit(500_000);
    await lottery.setRequestConfirmations(3);
    await lottery.setNumWords(7);
    await lottery.setKeyHash(ethers.ZeroHash);
    await lottery.setSubscriptionId(1);

    await lottery.startRound();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // Approve then buy — players must pre-approve the contract to spend USDC
  async function buyTicket(player, numbers) {
    await mockUSDC.connect(player).approve(await lottery.getAddress(), ENTRY_FEE);
    return lottery.connect(player).buyTicket(numbers);
  }

  async function expireRound() {
    await time.increase(ROUND_DURATION + 1);
  }

  async function runDrawWith(randomWords) {
    await expireRound();
    await lottery.performUpkeep(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256"],
        [await lottery.currentRoundId()]
      )
    );
    const requestId = await lottery.lastRequestId();
    await mockVRF.fulfillRandomWords(requestId, randomWords);
  }

  // ─── Payment token ───────────────────────────────────────────────────────────

  describe("Payment token", function () {
    it("is set to the USDC address provided at initialize5", async function () {
      expect(await lottery.paymentToken()).to.equal(await mockUSDC.getAddress());
    });

    it("setPaymentToken updates the token", async function () {
      const MockUSDC2 = await ethers.getContractFactory("MockUSDC");
      const anotherToken = await MockUSDC2.deploy();
      await lottery.setPaymentToken(await anotherToken.getAddress());
      expect(await lottery.paymentToken()).to.equal(await anotherToken.getAddress());
    });

    it("setPaymentToken reverts with zero address", async function () {
      await expect(lottery.setPaymentToken(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid token address");
    });

    it("setPaymentToken reverts when called by non-owner", async function () {
      await expect(lottery.connect(player1).setPaymentToken(await mockUSDC.getAddress()))
        .to.be.reverted;
    });
  });

  // ─── Pause / Unpause ────────────────────────────────────────────────────────

  describe("Pause / Unpause", function () {
    beforeEach(async function () {
      await lottery.pauseGame();
    });

    it("owner can pause the game", async function () {
      expect(await lottery.paused()).to.be.true;
    });

    it("reverts if already paused", async function () {
      await expect(lottery.pauseGame()).to.be.revertedWith("Already paused");
    });

    it("owner can unpause the game", async function () {
      await lottery.unpauseGame();
      expect(await lottery.paused()).to.be.false;
    });

    it("reverts if already unpaused", async function () {
      await lottery.unpauseGame();
      await expect(lottery.unpauseGame()).to.be.revertedWith("Not paused");
    });

    it("emits GamePaused event", async function () {
      await lottery.unpauseGame();
      await expect(lottery.pauseGame()).to.emit(lottery, "GamePaused").withArgs(owner.address);
    });

    it("emits GameUnpaused event", async function () {
      await expect(lottery.unpauseGame()).to.emit(lottery, "GameUnpaused").withArgs(owner.address);
    });

    it("non-owner cannot pause", async function () {
      await lottery.unpauseGame();
      await expect(lottery.connect(player1).pauseGame()).to.be.reverted;
    });

    it("non-owner cannot unpause", async function () {
      await expect(lottery.connect(player1).unpauseGame()).to.be.reverted;
    });
  });

  // ─── buyTicket ──────────────────────────────────────────────────────────────

  describe("buyTicket", function () {
    it("accepts a valid ticket and transfers USDC from player", async function () {
      const before = await mockUSDC.balanceOf(player1.address);
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      expect(await mockUSDC.balanceOf(player1.address)).to.equal(before - ENTRY_FEE);
    });

    it("emits TicketBought", async function () {
      await mockUSDC.connect(player1).approve(await lottery.getAddress(), ENTRY_FEE);
      await expect(lottery.connect(player1).buyTicket([1, 2, 3, 4, 5, 6, 7]))
        .to.emit(lottery, "TicketBought");
    });

    it("reverts without prior USDC approval", async function () {
      // No approve call — transferFrom will revert
      await expect(lottery.connect(player1).buyTicket([1, 2, 3, 4, 5, 6, 7]))
        .to.be.reverted;
    });

    it("reverts when game is paused", async function () {
      await lottery.pauseGame();
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]))
        .to.be.revertedWith("Game is paused");
    });

    it("reverts if player already entered this round", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      await expect(buyTicket(player1, [2, 3, 4, 5, 6, 7, 8]))
        .to.be.revertedWith("Already entered this round");
    });

    it("reverts with number out of range (0)", async function () {
      await mockUSDC.connect(player1).approve(await lottery.getAddress(), ENTRY_FEE);
      await expect(lottery.connect(player1).buyTicket([0, 2, 3, 4, 5, 6, 7]))
        .to.be.revertedWith("Number out of range");
    });

    it("reverts with number out of range (50)", async function () {
      await mockUSDC.connect(player1).approve(await lottery.getAddress(), ENTRY_FEE);
      await expect(lottery.connect(player1).buyTicket([1, 2, 3, 4, 5, 6, 50]))
        .to.be.revertedWith("Number out of range");
    });

    it("reverts with duplicate numbers", async function () {
      await mockUSDC.connect(player1).approve(await lottery.getAddress(), ENTRY_FEE);
      await expect(lottery.connect(player1).buyTicket([1, 1, 3, 4, 5, 6, 7]))
        .to.be.revertedWith("Duplicate number not allowed");
    });

    it("reverts when round has expired", async function () {
      await expireRound();
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]))
        .to.be.revertedWith("Round expired");
    });

    it("increases the round pot by the entry fee", async function () {
      const roundId = await lottery.currentRoundId();
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      const round = await lottery.rounds(roundId);
      expect(round.pot).to.equal(ENTRY_FEE);
    });

    it("no ETH is accepted — contract is not payable", async function () {
      await expect(
        player1.sendTransaction({ to: await lottery.getAddress(), value: ethers.parseEther("1") })
      ).to.be.reverted;
    });
  });

  // ─── checkUpkeep ────────────────────────────────────────────────────────────

  describe("checkUpkeep", function () {
    it("returns false before round expires", async function () {
      const [upkeepNeeded] = await lottery.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("returns true after round expires", async function () {
      await expireRound();
      const [upkeepNeeded] = await lottery.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
    });

    it("returns false when game is paused", async function () {
      await expireRound();
      await lottery.pauseGame();
      const [upkeepNeeded] = await lottery.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });
  });

  // ─── performUpkeep ──────────────────────────────────────────────────────────

  describe("performUpkeep", function () {
    it("reverts when game is paused", async function () {
      await expireRound();
      await lottery.pauseGame();
      await expect(
        lottery.performUpkeep(
          ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [await lottery.currentRoundId()])
        )
      ).to.be.revertedWith("Game is paused");
    });

    it("rolls empty round forward and starts a new one", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await expect(
        lottery.performUpkeep(
          ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
        )
      ).to.emit(lottery, "RoundSkipped");
      expect(await lottery.currentRoundId()).to.equal(roundId + 1n);
    });

    it("emits RoundClosed when tickets exist", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await expect(
        lottery.performUpkeep(
          ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
        )
      ).to.emit(lottery, "RoundClosed");
    });
  });

  // ─── VRF callback ────────────────────────────────────────────────────────────
  //
  // RANDOM_WORDS [1,2,3,4,5,6,7] → winning [1, 15, 16, 18, 22, 31, 38]

  describe("VRF callback — stores winning numbers and emits events", function () {
    const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];
    const WINNING = [1, 15, 16, 18, 22, 31, 38];

    beforeEach(async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      await buyTicket(player2, [1, 15, 16, 5, 6, 7, 8]);
    });

    it("stores the correct winning numbers", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      const nums = await lottery.getRoundWinningNumbers(roundId);
      expect(nums.map(n => Number(n))).to.deep.equal(WINNING);
    });

    it("emits WinningNumbersGenerated", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
      );
      const requestId = await lottery.lastRequestId();
      await expect(mockVRF.fulfillRandomWords(requestId, RANDOM_WORDS))
        .to.emit(lottery, "WinningNumbersGenerated");
    });

    it("round stays active and not drawn after callback", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      const round = await lottery.rounds(roundId);
      expect(round.active).to.be.true;
      expect(round.drawn).to.be.false;
    });

    it("no USDC rewards assigned during callback", async function () {
      await runDrawWith(RANDOM_WORDS);
      expect(await lottery.pendingRewards(player1.address)).to.equal(0n);
      expect(await lottery.pendingRewards(player2.address)).to.equal(0n);
    });
  });

  // ─── settleRound ─────────────────────────────────────────────────────────────
  //
  // RANDOM_WORDS [1,2,3,4,5,6,7] → winning [1, 15, 16, 18, 22, 31, 38]
  //
  // Prefix match examples against that winning sequence:
  //   [1, 15, 16, 18, 22, 31, 38] → 7 matches (jackpot)
  //   [1, 15, 16, 18, 22, 31, 39] → 6 matches
  //   [1, 15, 16, 18, 22, 32, 38] → 5 matches
  //   [1, 15, 16, 18, 23, 31, 38] → 4 matches
  //   [1, 15, 16, 19, 22, 31, 38] → 3 matches
  //   [1, 15, 17, 18, 22, 31, 38] → 2 matches
  //   [2, 15, 16, 18, 22, 31, 38] → 0 matches

  describe("settleRound", function () {
    const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    it("reverts when called by non-owner", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await expect(lottery.connect(player1).settleRound(roundId))
        .to.be.reverted;
    });

    it("reverts if winning numbers not set (VRF not fulfilled yet)", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      const roundId = await lottery.currentRoundId();
      await expect(lottery.settleRound(roundId))
        .to.be.revertedWith("Winning numbers not set");
    });

    it("reverts if round already settled", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      await expect(lottery.settleRound(roundId))
        .to.be.revertedWith("Round not active");
    });

    it("marks round as drawn and inactive", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      const round = await lottery.rounds(roundId);
      expect(round.drawn).to.be.true;
      expect(round.active).to.be.false;
    });

    it("starts a new round after settlement", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      expect(await lottery.currentRoundId()).to.equal(roundId + 1n);
    });

    it("emits RoundSettled", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await expect(lottery.settleRound(roundId))
        .to.emit(lottery, "RoundSettled");
    });

    it("assigns pending reward to a winning player", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]); // 7 matches
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      expect(await lottery.pendingRewards(player1.address)).to.be.gt(0n);
    });

    it("assigns no reward to a losing player", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]); // 7 matches — wins
      await buyTicket(player2, [2, 15, 16, 18, 22, 31, 38]); // 0 matches — loses
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      expect(await lottery.pendingRewards(player2.address)).to.equal(0n);
    });

    it("splits tier reward equally between two winners in the same tier", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]); // 7 matches
      await buyTicket(player2, [1, 15, 16, 18, 22, 31, 38]); // 7 matches — duplicate ticket allowed for different player
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      const r1 = await lottery.pendingRewards(player1.address);
      const r2 = await lottery.pendingRewards(player2.address);
      expect(r1).to.equal(r2);
      expect(r1).to.be.gt(0n);
    });

    it("accrues owner fee after settlement", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      expect(await lottery.ownerFeesAccrued()).to.be.gt(0n);
    });

    it("owner fee is 10% of the pot", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      const round = await lottery.rounds(roundId);
      const expectedFee = round.pot / 10n;
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      expect(await lottery.ownerFeesAccrued()).to.equal(expectedFee);
    });

    it("rolls over prize tiers with no winners into next round pot", async function () {
      // Only player1 plays and gets 2 matches — tiers 3-7 have no winners and roll over
      await buyTicket(player1, [1, 15, 17, 18, 22, 31, 38]); // 2 matches
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      // Read rolloverPool from the new round's pot since _startNewRound() zeroes rolloverPool
      const tx = await lottery.settleRound(roundId);
      await tx.wait();
      const newRoundId = await lottery.currentRoundId();
      const newRound = await lottery.rounds(newRoundId);
      expect(newRound.pot).to.be.gt(0n);
    });

    it("emits RewardAssigned for each winning ticket", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]); // 7 matches
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await expect(lottery.settleRound(roundId))
        .to.emit(lottery, "RewardAssigned");
    });
  });

  // ─── withdrawReward ─────────────────────────────────────────────────────────

  describe("withdrawReward", function () {
    const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    it("reverts when player has no pending reward", async function () {
      await expect(lottery.connect(player1).withdrawReward())
        .to.be.revertedWith("No reward available");
    });

    it("pays out USDC and zeroes pending reward", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]); // 7 matches
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);

      const reward = await lottery.pendingRewards(player1.address);
      expect(reward).to.be.gt(0n);

      const before = await mockUSDC.balanceOf(player1.address);
      await lottery.connect(player1).withdrawReward();
      const after = await mockUSDC.balanceOf(player1.address);

      expect(after - before).to.equal(reward);
      expect(await lottery.pendingRewards(player1.address)).to.equal(0n);
    });

    it("emits RewardWithdrawn", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);
      await expect(lottery.connect(player1).withdrawReward())
        .to.emit(lottery, "RewardWithdrawn");
    });
  });

  // ─── withdrawOwnerFees ──────────────────────────────────────────────────────

  describe("withdrawOwnerFees", function () {
    const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];

    it("reverts when called by non-owner", async function () {
      await expect(lottery.connect(player1).withdrawOwnerFees()).to.be.reverted;
    });

    it("reverts when no fees accrued", async function () {
      await expect(lottery.withdrawOwnerFees()).to.be.revertedWith("No owner fees");
    });

    it("pays out accrued fees to owner and zeroes the balance", async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      await lottery.settleRound(roundId);

      const fees = await lottery.ownerFeesAccrued();
      expect(fees).to.be.gt(0n);

      const before = await mockUSDC.balanceOf(owner.address);
      await lottery.withdrawOwnerFees();
      const after = await mockUSDC.balanceOf(owner.address);

      expect(after - before).to.equal(fees);
      expect(await lottery.ownerFeesAccrued()).to.equal(0n);
    });
  });

  // ─── Rollover pool ───────────────────────────────────────────────────────────

  describe("Rollover pool", function () {
    it("empty round moves pot to rollover and starts a new round", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
      );
      expect(await lottery.currentRoundId()).to.equal(roundId + 1n);
    });
  });

  // ─── Parameter bounds (USDC decimals) ───────────────────────────────────────

  describe("Parameter bounds", function () {
    let MIN_FEE, MAX_FEE, MIN_DURATION, MAX_DURATION;

    beforeEach(async function () {
      MIN_FEE      = await lottery.MIN_ENTRY_FEE();
      MAX_FEE      = await lottery.MAX_ENTRY_FEE();
      MIN_DURATION = await lottery.MIN_ROUND_DURATION();
      MAX_DURATION = await lottery.MAX_ROUND_DURATION();
    });

    it("setTicketPrice reverts below minimum (< 0.01 USDC)", async function () {
      await expect(lottery.setTicketPrice(MIN_FEE - 1n))
        .to.be.revertedWith("Price below minimum");
    });

    it("setTicketPrice reverts above maximum (> 1000 USDC)", async function () {
      await expect(lottery.setTicketPrice(MAX_FEE + 1n))
        .to.be.revertedWith("Price above maximum");
    });

    it("setTicketPrice accepts 1 USDC", async function () {
      await expect(lottery.setTicketPrice(1_000_000n)).to.not.be.reverted;
      expect(await lottery.entryFee()).to.equal(1_000_000n);
    });

    it("setRoundDuration reverts below minimum", async function () {
      await expect(lottery.setRoundDuration(MIN_DURATION - 1n))
        .to.be.revertedWith("Duration below minimum");
    });

    it("setRoundDuration reverts above maximum", async function () {
      await expect(lottery.setRoundDuration(MAX_DURATION + 1n))
        .to.be.revertedWith("Duration above maximum");
    });

    it("setRoundDuration accepts 1 day", async function () {
      const oneDay = BigInt(24 * 3600);
      await expect(lottery.setRoundDuration(oneDay)).to.not.be.reverted;
      expect(await lottery.roundDuration()).to.equal(oneDay);
    });
  });
});
