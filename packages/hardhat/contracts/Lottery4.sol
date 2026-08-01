// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Lottery is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    AutomationCompatibleInterface
{
    using SafeERC20 for IERC20;

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

    mapping(uint256 => mapping(address => bool)) public hasEntered;

    bool public paused;

    IERC20 public paymentToken;

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
    event GamePaused(address indexed by);
    event GameUnpaused(address indexed by);
    event PaymentTokenUpdated(address indexed token);

    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _paymentToken) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
    }

    modifier whenNotPaused() {
        require(!paused, "Game is paused");
        _;
    }

    function pauseGame() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit GamePaused(msg.sender);
    }

    function unpauseGame() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit GameUnpaused(msg.sender);
    }

    // Players must approve this contract to spend entryFee USDC before calling.
    function buyTicket(uint8[7] calldata numbers) external whenNotPaused {
        _validateTicketNumbers(numbers);

        RoundInfo storage round = rounds[currentRoundId];
        require(round.active, "No active round");
        require(!round.drawRequested, "Draw already requested");
        require(block.timestamp < round.endTime, "Round expired");
        require(!hasEntered[currentRoundId][msg.sender], "Already entered this round");

        paymentToken.safeTransferFrom(msg.sender, address(this), entryFee);

        hasEntered[currentRoundId][msg.sender] = true;
        round.pot += entryFee;

        roundTickets[currentRoundId].push(
            Ticket({
                player: msg.sender,
                numbers: numbers,
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

        upkeepNeeded =
            !paused &&
            round.active &&
            !round.drawRequested &&
            block.timestamp >= round.endTime;

        performData = abi.encode(currentRoundId);
    }

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
    }

    function settleRound(uint256 roundId) external onlyOwner {
        uint8[7] memory winning = roundWinningNumbers[roundId];
        require(winning[0] != 0, "Winning numbers not set");
        _settleRound(roundId, winning);
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
        paymentToken.safeTransfer(msg.sender, amount);

        emit RewardWithdrawn(msg.sender, amount);
    }

    function withdrawOwnerFees() external onlyOwner {
        uint256 amount = ownerFeesAccrued;
        require(amount > 0, "No owner fees");

        ownerFeesAccrued = 0;
        paymentToken.safeTransfer(owner(), amount);

        emit OwnerFeesWithdrawn(owner(), amount);
    }

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
            uint8 matchedCount,
            uint256 reward
        )
    {
        Ticket storage ticket = roundTickets[roundId][ticketIndex];
        return (
            ticket.player,
            ticket.numbers,
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

    // USDC has 6 decimals: 1 USDC = 1_000_000. Bounds are 0.01 USDC – 1000 USDC.
    uint256 public constant MIN_ENTRY_FEE      = 10_000;        // 0.01 USDC
    uint256 public constant MAX_ENTRY_FEE      = 1_000_000_000; // 1000 USDC
    uint256 public constant MIN_ROUND_DURATION = 1 minutes;
    uint256 public constant MAX_ROUND_DURATION = 7 days;

    function setTicketPrice(uint256 price) external onlyOwner {
        require(price >= MIN_ENTRY_FEE, "Price below minimum");
        require(price <= MAX_ENTRY_FEE, "Price above maximum");
        entryFee = price;
    }

    function setRoundDuration(uint256 time) external onlyOwner {
        require(time >= MIN_ROUND_DURATION, "Duration below minimum");
        require(time <= MAX_ROUND_DURATION, "Duration above maximum");
        roundDuration = time;
    }

    function setAutomationNativePayment(bool enabled) external onlyOwner {
        automationNativePayment = enabled;
    }

    function updateCoordinator(address newCoordinator) external onlyOwner {
        s_vrfCoordinator = IVRFCoordinatorV2Plus(newCoordinator);
    }

    function setPaymentToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        paymentToken = IERC20(token);
        emit PaymentTokenUpdated(token);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
