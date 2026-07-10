// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract WinningNumbers is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    IVRFCoordinatorV2Plus public s_vrfCoordinator;

    uint256 public subscriptionId;
    bytes32 public keyHash;

    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;
    uint32 public numWords;

    uint256 public lastRequestId;
    uint256[] public lastRandomWords;

    uint8[7] public winningNumbers;

    struct RequestStatus {
        bool exists;
        bool fulfilled;
        uint256[] randomWords;
    }

    mapping(uint256 => RequestStatus) public requests;

    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);
    event WinningNumbersGenerated(uint256 requestId, uint8[7] winningNumbers);

    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        s_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;

        callbackGasLimit = 700_000;
        requestConfirmations = 3;
        numWords = 7;
    }

    function requestRandomWords(bool enableNativePayment)
        external
        onlyOwner
        returns (uint256 requestId)
    {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: enableNativePayment})
                )
            })
        );

        requests[requestId] = RequestStatus({
            exists: true,
            fulfilled: false,
            randomWords: new uint256[](0)
        });

        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == address(s_vrfCoordinator), "Only coordinator can fulfill");
        require(requests[requestId].exists, "Request not found");

        requests[requestId].fulfilled = true;
        requests[requestId].randomWords = randomWords;
        lastRandomWords = randomWords;

        winningNumbers = _generateWinningNumbers(randomWords);

        emit RequestFulfilled(requestId, randomWords);
        emit WinningNumbersGenerated(requestId, winningNumbers);
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

    function updateCoordinator(address newCoordinator) external onlyOwner {
        s_vrfCoordinator = IVRFCoordinatorV2Plus(newCoordinator);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
