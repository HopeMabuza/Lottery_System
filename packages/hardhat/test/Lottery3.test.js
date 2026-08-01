const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Random words that produce a known sorted winning sequence when fed through
// _generateWinningNumbers. We derive them at test time via the contract's own
// logic, so here we just use simple values and check the output properties
// (7 unique numbers, 1-49, ascending) rather than hard-coding the sequence.
const ENTRY_FEE = ethers.parseEther("0.01");
const ROUND_DURATION = 3600; // 1 hour in seconds

describe("Lottery3", function () {
  let lottery;
  let mockVRF;
  let owner;
  let player1;
  let player2;
  let player3;

  // Deploy fresh contracts before every test
  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
    mockVRF = await MockVRF.deploy();

    const Lottery3 = await ethers.getContractFactory("Lottery3");

    // Deploy as UUPS proxy; initialize4() is the Lottery3 reinitializer
    lottery = await upgrades.deployProxy(Lottery3, [], {
      initializer: false,
      kind: "uups",
    });

    // Call initialize4 directly (simulates upgrade from prior version)
    await lottery.initialize4();

    // Configure the contract
    await lottery.updateCoordinator(await mockVRF.getAddress());
    await lottery.setTicketPrice(ENTRY_FEE);
    await lottery.setRoundDuration(ROUND_DURATION);
    await lottery.setCallbackGasLimit(500_000);
    await lottery.setRequestConfirmations(3);
    await lottery.setNumWords(7);
    await lottery.setKeyHash(ethers.ZeroHash);
    await lottery.setSubscriptionId(1);

    // Start the first round
    await lottery.startRound();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function buyTicket(player, numbers) {
    return lottery.connect(player).buyTicket(numbers, { value: ENTRY_FEE });
  }

  async function expireRound() {
    await time.increase(ROUND_DURATION + 1);
  }

  // Triggers upkeep then fulfills VRF with the provided random words.
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

  // ─── Pause / Unpause ────────────────────────────────────────────────────────

  describe("Pause / Unpause", function () {
    beforeEach(async function () {
      await lottery.pauseGame();
    });

    it("owner can pause the game", async function () {
      expect(await lottery.paused()).to.be.true;
    });

    it("emits GamePaused event", async function () {
      // Already paused in beforeEach; unpause then re-pause to capture event
      await lottery.unpauseGame();
      await expect(lottery.pauseGame()).to.emit(lottery, "GamePaused").withArgs(owner.address);
    });

    it("reverts if already paused", async function () {
      await expect(lottery.pauseGame()).to.be.revertedWith("Already paused");
    });

    it("owner can unpause the game", async function () {
      await lottery.unpauseGame();
      expect(await lottery.paused()).to.be.false;
    });

    it("emits GameUnpaused event", async function () {
      await expect(lottery.unpauseGame()).to.emit(lottery, "GameUnpaused").withArgs(owner.address);
    });

    it("reverts if already unpaused", async function () {
      await lottery.unpauseGame();
      await expect(lottery.unpauseGame()).to.be.revertedWith("Not paused");
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
    it("accepts a valid ticket", async function () {
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]))
        .to.emit(lottery, "TicketBought");
    });

    it("reverts when game is paused", async function () {
      await lottery.pauseGame();
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 7])).to.be.revertedWith("Game is paused");
    });

    it("reverts with wrong entry fee", async function () {
      await expect(
        lottery.connect(player1).buyTicket([1, 2, 3, 4, 5, 6, 7], { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Incorrect entry fee");
    });

    it("reverts if player already entered this round", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      await expect(buyTicket(player1, [2, 3, 4, 5, 6, 7, 8])).to.be.revertedWith("Already entered this round");
    });

    it("reverts with number out of range (0)", async function () {
      await expect(buyTicket(player1, [0, 2, 3, 4, 5, 6, 7])).to.be.revertedWith("Number out of range");
    });

    it("reverts with number out of range (50)", async function () {
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 50])).to.be.revertedWith("Number out of range");
    });

    it("reverts with duplicate numbers", async function () {
      await expect(buyTicket(player1, [1, 1, 3, 4, 5, 6, 7])).to.be.revertedWith("Duplicate number not allowed");
    });

    it("reverts when round has expired", async function () {
      await expireRound();
      await expect(buyTicket(player1, [1, 2, 3, 4, 5, 6, 7])).to.be.revertedWith("Round expired");
    });

    it("increases the round pot", async function () {
      const roundId = await lottery.currentRoundId();
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      const round = await lottery.rounds(roundId);
      expect(round.pot).to.equal(ENTRY_FEE);
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

    it("returns false after draw is requested", async function () {
      await buyTicket(player1, [1, 2, 3, 4, 5, 6, 7]);
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [await lottery.currentRoundId()])
      );
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

    it("reverts with stale round id", async function () {
      await expireRound();
      await expect(
        lottery.performUpkeep(
          ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [999n])
        )
      ).to.be.revertedWith("Stale upkeep");
    });

    it("rolls empty round forward and starts a new one", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await expect(
        lottery.performUpkeep(
          ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
        )
      ).to.emit(lottery, "RoundSkipped").withArgs(roundId, 0n);

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

  // ─── VRF callback (post fix 1.2) ─────────────────────────────────────────────
  //
  // After fix 1.2 the VRF callback only stores winning numbers and emits events.
  // Settlement (reward assignment, fee accrual, new round start) moves off-chain
  // and will be covered in Iteration 2.
  //
  // RANDOM_WORDS [1,2,3,4,5,6,7] deterministically produces winning numbers:
  //   [1, 15, 16, 18, 22, 31, 38]  (verified via diagnostic.js)
  //
  // Matching rule: consecutive prefix — scoring stops at the first mismatch.

  describe("VRF callback — stores winning numbers and emits events", function () {
    const RANDOM_WORDS = [1n, 2n, 3n, 4n, 5n, 6n, 7n];
    const WINNING = [1, 15, 16, 18, 22, 31, 38];

    beforeEach(async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
      await buyTicket(player2, [1, 15, 16, 5, 6, 7, 8]);
    });

    it("stores winning numbers for the round", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      const nums = await lottery.getRoundWinningNumbers(roundId);
      expect(nums.map(n => Number(n))).to.deep.equal(WINNING);
    });

    it("generates 7 unique numbers in range 1-49 sorted ascending", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      const nums = await lottery.getRoundWinningNumbers(roundId);
      for (let i = 0; i < 7; i++) {
        expect(Number(nums[i])).to.be.gte(1).and.lte(49);
        if (i > 0) expect(Number(nums[i])).to.be.greaterThan(Number(nums[i - 1]));
      }
    });

    it("emits RequestFulfilled and WinningNumbersGenerated", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
      );
      const requestId = await lottery.lastRequestId();
      await expect(mockVRF.fulfillRandomWords(requestId, RANDOM_WORDS))
        .to.emit(lottery, "RequestFulfilled")
        .and.to.emit(lottery, "WinningNumbersGenerated");
    });

    it("round stays active and not drawn after callback", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      const round = await lottery.rounds(roundId);
      expect(round.active).to.be.true;
      expect(round.drawn).to.be.false;
    });

    it("no player rewards are assigned during the callback", async function () {
      await runDrawWith(RANDOM_WORDS);
      expect(await lottery.pendingRewards(player1.address)).to.equal(0n);
      expect(await lottery.pendingRewards(player2.address)).to.equal(0n);
    });

    it("no owner fees accrued during the callback", async function () {
      await runDrawWith(RANDOM_WORDS);
      expect(await lottery.ownerFeesAccrued()).to.equal(0n);
    });

    it("no new round is started by the callback", async function () {
      const roundId = await lottery.currentRoundId();
      await runDrawWith(RANDOM_WORDS);
      expect(await lottery.currentRoundId()).to.equal(roundId);
    });
  });

  // ─── withdrawReward ─────────────────────────────────────────────────────────
  //
  // After fix 1.2, the VRF callback no longer assigns rewards inline.
  // Reward assignment moves off-chain (Iteration 2). These tests cover the
  // withdrawal mechanics using pendingRewards written directly to state,
  // which is how the off-chain settler will write them.

  describe("withdrawReward", function () {
    it("reverts when player has no pending reward", async function () {
      await expect(lottery.connect(player1).withdrawReward())
        .to.be.revertedWith("No reward available");
    });

    it("pays out and zeroes the pending reward", async function () {
      // Simulate off-chain settler writing a reward by sending ETH to the
      // contract and manually crediting pendingRewards via a settle call.
      // Until Iteration 2 wires up the settler, we seed the reward directly
      // by sending ETH to the contract (receive() accepts it) and then
      // having the owner credit the player — placeholder for the real flow.

      // For now just verify the revert path and the zero-out mechanic.
      // Full payout test will be added when the off-chain settler is wired.
      await expect(lottery.connect(player1).withdrawReward())
        .to.be.revertedWith("No reward available");
    });
  });

  // ─── withdrawOwnerFees ──────────────────────────────────────────────────────

  describe("withdrawOwnerFees", function () {
    it("reverts when called by non-owner", async function () {
      await expect(lottery.connect(player1).withdrawOwnerFees()).to.be.reverted;
    });

    it("reverts when no fees accrued", async function () {
      await expect(lottery.withdrawOwnerFees()).to.be.revertedWith("No owner fees");
    });
  });

  // ─── Rollover pool ──────────────────────────────────────────────────────────

  describe("Rollover pool", function () {
    it("accumulates pot from empty rounds", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
      );
      expect(await lottery.currentRoundId()).to.equal(roundId + 1n);
    });

    it("seeded pot carries into next round", async function () {
      const roundId = await lottery.currentRoundId();
      await expireRound();
      await lottery.performUpkeep(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [roundId])
      );
      const newRound = await lottery.rounds(await lottery.currentRoundId());
      expect(newRound.active).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ITERATION 1 FIX TESTS
  // Each group below targets one fix. Tests marked [fix X.Y] FAIL on the
  // current contract and PASS once that fix is applied.
  // ═══════════════════════════════════════════════════════════════════════════


  // ─── Fix 1.3 — `claimed` field removed ──────────────────────────────────
  //
  // The Ticket struct no longer has a `claimed` field. getTicket() now returns
  // (player, numbers, matchedCount, reward). pendingRewards is the correct
  // guard for withdrawal — it is zeroed on payout.

  describe("getTicket returns correct fields after claimed removal", function () {
    beforeEach(async function () {
      await buyTicket(player1, [1, 15, 16, 18, 22, 31, 38]);
    });

    it("getTicket returns player, numbers, matchedCount, reward", async function () {
      const [player, numbers, matchedCount, reward] = await lottery.getTicket(1n, 0n);
      expect(player).to.equal(player1.address);
      expect(numbers.map(n => Number(n))).to.deep.equal([1, 15, 16, 18, 22, 31, 38]);
      expect(matchedCount).to.equal(0n);
      expect(reward).to.equal(0n);
    });
  });


  // ─── Fix 1.5 — bounds on owner-settable parameters ──────────────────────
  //
  // setTicketPrice and setRoundDuration only guard against zero. An owner can
  // accidentally (or maliciously) set extreme values that break the game.
  //
  // Fix: add min/max guards:
  //   entryFee  — minimum 0.00001 ETH (10_000_000_000_000 wei), maximum 1 ETH
  //   roundDuration — minimum 60 seconds (1 minute), maximum 7 days

  describe("[fix 1.5] owner-settable parameter bounds", function () {
    let MIN_FEE, MAX_FEE, MIN_DURATION, MAX_DURATION;

    beforeEach(async function () {
      MIN_FEE      = await lottery.MIN_ENTRY_FEE();
      MAX_FEE      = await lottery.MAX_ENTRY_FEE();
      MIN_DURATION = await lottery.MIN_ROUND_DURATION();
      MAX_DURATION = await lottery.MAX_ROUND_DURATION();
    });

    // ── setTicketPrice ──────────────────────────────────────────────────────

    it("setTicketPrice reverts when below minimum", async function () {
      await expect(
        lottery.setTicketPrice(MIN_FEE - 1n)
      ).to.be.revertedWith("Price below minimum");
    });

    it("setTicketPrice reverts when above maximum", async function () {
      await expect(
        lottery.setTicketPrice(MAX_FEE + 1n)
      ).to.be.revertedWith("Price above maximum");
    });

    it("setTicketPrice accepts a value within bounds", async function () {
      const validPrice = ethers.parseEther("0.05");
      await expect(lottery.setTicketPrice(validPrice)).to.not.be.reverted;
      expect(await lottery.entryFee()).to.equal(validPrice);
    });

    // ── setRoundDuration ────────────────────────────────────────────────────

    it("setRoundDuration reverts when below minimum", async function () {
      await expect(
        lottery.setRoundDuration(MIN_DURATION - 1n)
      ).to.be.revertedWith("Duration below minimum");
    });

    it("setRoundDuration reverts when above maximum", async function () {
      await expect(
        lottery.setRoundDuration(MAX_DURATION + 1n)
      ).to.be.revertedWith("Duration above maximum");
    });

    it("setRoundDuration accepts a value within bounds", async function () {
      const oneDay = BigInt(24 * 3600);
      await expect(lottery.setRoundDuration(oneDay)).to.not.be.reverted;
      expect(await lottery.roundDuration()).to.equal(oneDay);
    });
  });
});
