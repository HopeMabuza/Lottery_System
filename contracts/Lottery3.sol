// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Lottery3 is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    AutomationCompatibleInterface
{
    IVRFCoordinatorV2Plus public s_vrfCoordinator;

    uint256 public subscriptionId;
    bytes32 public keyHash;

    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;
    uint32 public numWords;

    uint256 public lastRequestId;
    uint256[] public lastRandomWords;

    uint8[7] public winningNumbers;

    uint256 public constant OWNER_FEE_BPS = 1000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct RequestStatus {
        bool exists;
        bool fulfilled;
        uint256[] randomWords;
    }

    struct Ticket {
        address player;
        uint8[7] numbers;
        bool claimed;
        uint8 matchedCount;
        uint256 reward;
    }

    struct RoundInfo {
        bool active;
        bool drawRequested;
        bool drawn;
        uint256 startTime;
        uint256 endTime;
        uint256 pot;
    }

    mapping(uint256 => RequestStatus) public requests;
    mapping(uint256 => uint256) public requestToRoundId;

    mapping(uint256 => RoundInfo) public rounds;
    mapping(uint256 => Ticket[]) private roundTickets;
    mapping(uint256 => uint8[7]) public roundWinningNumbers;

    mapping(address => uint256) public pendingRewards;

    uint256 public ownerFeesAccrued;
    uint256 public rolloverPool;
    uint256 public currentRoundId;

    uint256 public entryFee;
    uint256 public roundDuration;
    bool public automationNativePayment;

    // new in Lottery2
    mapping(uint256 => mapping(address => bool)) public hasEntered;

    // --- new in Lottery3 ---
    // Pause flag. bool packs into one slot; __gap reduced by 1 to compensate.
    bool public paused;

    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);
    event WinningNumbersGenerated(uint256 requestId, uint256 roundId, uint8[7] winningNumbers);

    event RoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime, uint256 seededPot);
    event TicketBought(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8[7] numbers);
    event RoundClosed(uint256 indexed roundId, uint256 requestId);
    event RoundSettled(uint256 indexed roundId, uint8[7] winningNumbers, uint256 ownerFee, uint256 rolloverAdded);
    event RoundSkipped(uint256 indexed roundId, uint256 rolloverAmount);
    event RewardAssigned(uint256 indexed roundId, address indexed player, uint256 ticketIndex, uint8 matches, uint256 reward);
    event RewardWithdrawn(address indexed player, uint256 amount);
    event OwnerFeesWithdrawn(address indexed owner, uint256 amount);
    // Emitted when owner pauses or unpauses the game
    event GamePaused(address indexed by);
    event GameUnpaused(address indexed by);

    // Reduced from [38] to [37]: `paused` bool occupies one new storage slot
    uint256[37] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @custom:oz-upgrades-validate-as-initializer
    function initialize4() public reinitializer(4) {
        // No need to re-init ownership, already set in previous versions.
        __Ownable_init_unchained();
        // Game starts unpaused; owner must explicitly pause if needed
        paused = false;
    }


    // Reverts any state-changing call while the game is paused.
    // rawFulfillRandomWords is intentionally NOT gated by this modifier
    // so that in-flight VRF responses can still land and settle funds safely.
    modifier whenNotPaused() {
        require(!paused, "Game is paused");
        _;
    }

    // Pauses the game: blocks ticket purchases, automation upkeep, and manual
    // round starts. Only callable by the owner.
    function pauseGame() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit GamePaused(msg.sender);
    }

    // Unpauses the game and restores normal operation.
    // If no round is active after unpausing, call startRound() manually.
    function unpauseGame() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit GameUnpaused(msg.sender);
    }

    // Blocked while paused so no tickets can be sold during a pause
    function buyTicket(uint8[7] calldata numbers) external payable whenNotPaused {
        require(msg.value == entryFee, "Incorrect entry fee");
        _validateTicketNumbers(numbers);

        RoundInfo storage round = rounds[currentRoundId];
        require(round.active, "No active round");
        require(!round.drawRequested, "Draw already requested");
        require(block.timestamp < round.endTime, "Round expired");
        require(!hasEntered[currentRoundId][msg.sender], "Already entered this round");

        hasEntered[currentRoundId][msg.sender] = true;
        round.pot += msg.value;

        roundTickets[currentRoundId].push(
            Ticket({
                player: msg.sender,
                numbers: numbers,
                claimed: false,
                matchedCount: 0,
                reward: 0
            })
        );

        emit TicketBought(
            currentRoundId,
            msg.sender,
            roundTickets[currentRoundId].length - 1,
            numbers
        );
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        RoundInfo storage round = rounds[currentRoundId];

        // Return false when paused so Chainlink Automation stops triggering upkeep
        upkeepNeeded =
            !paused &&
            round.active &&
            !round.drawRequested &&
            block.timestamp >= round.endTime;

        performData = abi.encode(currentRoundId);
    }

    // Second safety layer on top of checkUpkeep: rejects upkeep calls while paused
    function performUpkeep(bytes calldata performData) external override whenNotPaused {
        uint256 roundIdFromCheck = abi.decode(performData, (uint256));

        RoundInfo storage round = rounds[currentRoundId];

        require(roundIdFromCheck == currentRoundId, "Stale upkeep");
        require(round.active, "No active round");
        require(!round.drawRequested, "Draw already requested");
        require(block.timestamp >= round.endTime, "Round still active");

        if (roundTickets[currentRoundId].length == 0) {
            _rollEmptyRoundForward();
            return;
        }

        _requestRandomWordsForCurrentRound();
    }

    function _requestRandomWordsForCurrentRound() internal returns (uint256 requestId) {
        RoundInfo storage round = rounds[currentRoundId];

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: automationNativePayment})
                )
            })
        );

        requests[requestId] = RequestStatus({
            exists: true,
            fulfilled: false,
            randomWords: new uint256[](0)
        });

        requestToRoundId[requestId] = currentRoundId;
        lastRequestId = requestId;
        round.drawRequested = true;

        emit RequestSent(requestId, numWords);
        emit RoundClosed(currentRoundId, requestId);
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == address(s_vrfCoordinator), "Only coordinator can fulfill");
        require(requests[requestId].exists, "Request not found");

        requests[requestId].fulfilled = true;
        requests[requestId].randomWords = randomWords;
        lastRandomWords = randomWords;

        uint256 roundId = requestToRoundId[requestId];
        require(roundId != 0, "Round not linked");

        winningNumbers = _generateWinningNumbers(randomWords);
        roundWinningNumbers[roundId] = winningNumbers;

        emit RequestFulfilled(requestId, randomWords);
        emit WinningNumbersGenerated(requestId, roundId, winningNumbers);

        _settleRound(roundId, winningNumbers);
    }

    function _settleRound(uint256 roundId, uint8[7] memory _winningNumbers) internal {
        RoundInfo storage round = rounds[roundId];
        require(round.active, "Round not active");
        require(round.drawRequested, "Draw not requested");
        require(!round.drawn, "Round already settled");

        Ticket[] storage tickets = roundTickets[roundId];
        uint256 ticketCount = tickets.length;

        uint256[8] memory winnersPerTier;

        for (uint256 i = 0; i < ticketCount; i++) {
            uint8 matches_ = _countPrefixMatches(tickets[i].numbers, _winningNumbers);
            tickets[i].matchedCount = matches_;

            if (matches_ >= 2) {
                winnersPerTier[matches_]++;
            }
        }

        uint256 ownerFee = (round.pot * OWNER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 prizePool = round.pot - ownerFee;
        uint256 rolloverAdded = 0;

        uint256[8] memory tierPool;
        tierPool[2] = (prizePool * 5) / 100;
        tierPool[3] = (prizePool * 10) / 100;
        tierPool[4] = (prizePool * 15) / 100;
        tierPool[5] = (prizePool * 20) / 100;
        tierPool[6] = (prizePool * 20) / 100;
        tierPool[7] = (prizePool * 30) / 100;

        uint256[8] memory rewardPerWinner;

        for (uint8 tier = 2; tier <= 7; tier++) {
            if (winnersPerTier[tier] > 0) {
                rewardPerWinner[tier] = tierPool[tier] / winnersPerTier[tier];
            } else {
                rolloverAdded += tierPool[tier];
            }
        }

        for (uint256 i = 0; i < ticketCount; i++) {
            uint8 matched = tickets[i].matchedCount;

            if (matched >= 2) {
                uint256 reward = rewardPerWinner[matched];
                tickets[i].reward = reward;
                pendingRewards[tickets[i].player] += reward;

                emit RewardAssigned(roundId, tickets[i].player, i, matched, reward);
            }
        }

        ownerFeesAccrued += ownerFee;
        rolloverPool += rolloverAdded;

        round.drawn = true;
        round.active = false;

        emit RoundSettled(roundId, _winningNumbers, ownerFee, rolloverAdded);

        _startNewRound();
    }

    function _rollEmptyRoundForward() internal {
        RoundInfo storage round = rounds[currentRoundId];
        require(round.active, "No active round");
        require(!round.drawRequested, "Draw already requested");
        require(block.timestamp >= round.endTime, "Round still active");

        rolloverPool += round.pot;

        round.drawn = true;
        round.active = false;

        emit RoundSkipped(currentRoundId, round.pot);

        _startNewRound();
    }

    function withdrawReward() external {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No reward available");

        pendingRewards[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Reward transfer failed");

        emit RewardWithdrawn(msg.sender, amount);
    }

    function withdrawOwnerFees() external onlyOwner {
        uint256 amount = ownerFeesAccrued;
        require(amount > 0, "No owner fees");

        ownerFeesAccrued = 0;

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Owner fee transfer failed");

        emit OwnerFeesWithdrawn(owner(), amount);
    }

    // Blocked while paused so the owner cannot start a round in a paused state
    function startRound() external onlyOwner whenNotPaused {
        _startNewRound();
    }

    function _startNewRound() internal {
        require(
            currentRoundId == 0 || !rounds[currentRoundId].active,
            "Current round still active"
        );

        currentRoundId++;

        rounds[currentRoundId] = RoundInfo({
            active: true,
            drawRequested: false,
            drawn: false,
            startTime: block.timestamp,
            endTime: block.timestamp + roundDuration,
            pot: rolloverPool
        });

        emit RoundStarted(
            currentRoundId,
            block.timestamp,
            block.timestamp + roundDuration,
            rolloverPool
        );

        rolloverPool = 0;
    }

    function _validateTicketNumbers(uint8[7] calldata numbers) internal pure {
        bool[50] memory used;

        for (uint256 i = 0; i < numbers.length; i++) {
            require(numbers[i] >= 1 && numbers[i] <= 49, "Number out of range");
            require(!used[numbers[i]], "Duplicate number not allowed");
            used[numbers[i]] = true;
        }
    }

    //check if player is the winner, increment if they are
    function _countPrefixMatches(uint8[7] memory player, uint8[7] memory winner)
        internal
        pure
        returns (uint8 count)
    {
        for (uint8 i = 0; i < 7; i++) {
            if (player[i] == winner[i]) {
                count++;
            } else {
                break;
            }
        }
    }

    //get winning numbers from randomWords from Chainlink
    function _generateWinningNumbers(uint256[] calldata randomWords)
        internal
        pure
        returns (uint8[7] memory result)
    {
        bool[50] memory used;
        uint256 count = 0;
        uint256 nonce = 0;

        while (count < 7) {
            for (uint256 i = 0; i < randomWords.length && count < 7; i++) {
                uint8 candidate = uint8(
                    (uint256(keccak256(abi.encode(randomWords[i], nonce))) % 49) + 1
                );

                if (!used[candidate]) {
                    used[candidate] = true;
                    result[count] = candidate;
                    count++;
                }

                nonce++;
            }
        }

        _sortAscending(result);
        return result;
    }

    //sort winning numbers(helper)
    function _sortAscending(uint8[7] memory arr) internal pure {
        for (uint256 i = 0; i < arr.length; i++) {
            for (uint256 j = i + 1; j < arr.length; j++) {
                if (arr[j] < arr[i]) {
                    uint8 temp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = temp;
                }
            }
        }
    }

    function getRequestStatus(uint256 requestId)
        external
        view
        returns (bool fulfilled, uint256[] memory randomWords)
    {
        require(requests[requestId].exists, "Request not found");
        RequestStatus storage request = requests[requestId];
        return (request.fulfilled, request.randomWords);
    }

    function getLastRandomWords() external view returns (uint256[] memory) {
        return lastRandomWords;
    }

    function getWinningNumbers() external view returns (uint8[7] memory) {
        return winningNumbers;
    }

    function getRoundWinningNumbers(uint256 roundId) external view returns (uint8[7] memory) {
        return roundWinningNumbers[roundId];
    }

    function getRoundTicketCount(uint256 roundId) external view returns (uint256) {
        return roundTickets[roundId].length;
    }

    function getTicket(uint256 roundId, uint256 ticketIndex)
        external
        view
        returns (
            address player,
            uint8[7] memory numbers,
            bool claimed,
            uint8 matchedCount,
            uint256 reward
        )
    {
        Ticket storage ticket = roundTickets[roundId][ticketIndex];
        return (
            ticket.player,
            ticket.numbers,
            ticket.claimed,
            ticket.matchedCount,
            ticket.reward
        );
    }

    function setCallbackGasLimit(uint32 _callbackGasLimit) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
    }

    function setRequestConfirmations(uint16 _requestConfirmations) external onlyOwner {
        requestConfirmations = _requestConfirmations;
    }

    function setNumWords(uint32 _numWords) external onlyOwner {
        require(_numWords > 0, "numWords must be > 0");
        numWords = _numWords;
    }

    function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setKeyHash(bytes32 _keyHash) external onlyOwner {
        keyHash = _keyHash;
    }

    function setTicketPrice(uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        entryFee = price;
    }

    function setRoundDuration(uint256 time) external onlyOwner {
        require(time > 0, "Duration must be > 0");
        roundDuration = time;
    }

    function setAutomationNativePayment(bool enabled) external onlyOwner {
        automationNativePayment = enabled;
    }

    function updateCoordinator(address newCoordinator) external onlyOwner {
        s_vrfCoordinator = IVRFCoordinatorV2Plus(newCoordinator);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}
}
