// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CZT_Staking is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {
    IERC20 public cztToken;

    uint256 public taxRate;
    address public devWallet;
    uint256 public period;
    uint256 public rewardsDenominator;
    uint256 public taxDenominator;

    struct Tier {
        uint256 dailyRatePPM;
        uint256 lockDays;
    }
    uint256 public TierCount;
    mapping(uint256 => Tier) public Tiers;

    struct UserStake {
        uint256 TierId;
        uint256 stakedAmount;
        uint256 startTime;
        uint256 lastClaimed;
        bool isActive;
    }
    mapping(address => UserStake[]) public stakes;

    uint256 public totalTax;
    uint256 public rewardPool;
    uint256 public totalStaked;

    uint256[50] private _gap;

    event Deposited(address indexed user, uint256 indexed TierId, uint256 indexed stakeIndex, uint256 amount);
    event ClaimedRewards(address indexed user, uint256 indexed stakeIndex, uint256 amount);
    event Withdrawal(address indexed user, uint256 indexed stakeIndex, uint256 amount);
    event WithdrawStuckTokens(address owner, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _cztToken, address _devWallet) public initializer {
        __Ownable_init(msg.sender);
        cztToken = IERC20(_cztToken);
        devWallet = _devWallet;
        taxRate = 1000; // 10%
        period = 2 minutes; //DONT FORGET: change back to 1 days for final deployment
        rewardsDenominator = 1_000_000;
        taxDenominator = 10_000;

        Tiers[0] = Tier(328,  0);   // Flexible   12% APR
        Tiers[1] = Tier(493,  30);  // Fixed 30d  18% APR
        Tiers[2] = Tier(602,  90);  // Fixed 90d  22% APR
        Tiers[3] = Tier(684,  180); // Fixed 180d 25% APR
        TierCount = 4;
    }

    function deposit(uint256 _TierId, uint256 _amount) external nonReentrant {
        require(_TierId < TierCount, "Tier does not exist");
        require(_amount > 0, "Amount must be greater than zero");

        //funds go to contract
        cztToken.transferFrom(msg.sender, address(this), _amount);
        
        //deduct fees
        uint256 depositTax = (_amount * taxRate) / taxDenominator;
        cztToken.transfer(devWallet, depositTax);
        totalTax += depositTax;

        //user's stake
        uint256 _stakedAmount = _amount - depositTax;
       

        stakes[msg.sender].push(UserStake({
            TierId: _TierId,
            stakedAmount: _stakedAmount,
            startTime: block.timestamp,
            lastClaimed: 0,
            isActive: true
        }));

        uint256 stakeIndex = stakes[msg.sender].length - 1;
        totalStaked += _stakedAmount;

        emit Deposited(msg.sender, _TierId, stakeIndex, _amount);
    }

    function claimRewards(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < stakes[msg.sender].length, "Stake does not exist");
        UserStake memory stake = stakes[msg.sender][stakeIndex];
        require(stake.isActive, "No active stake");

        uint256 rewards = rewardsCalculator(msg.sender, stakeIndex);
        require(rewards > 0, "No rewards to claim");
        require(rewardPool >= rewards, "Insufficient reward pool");

        stakes[msg.sender][stakeIndex].lastClaimed = block.timestamp;
        rewardPool -= rewards;

        uint256 rewardTax = (rewards * taxRate) / taxDenominator;
        cztToken.transfer(devWallet, rewardTax);
        totalTax += rewardTax;

        cztToken.transfer(msg.sender, rewards - rewardTax);

        emit ClaimedRewards(msg.sender, stakeIndex, rewards);
    }

    function withdrawAll(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < stakes[msg.sender].length, "Stake does not exist");
        UserStake memory stake = stakes[msg.sender][stakeIndex];
        require(stake.isActive, "No active stake");

        Tier memory tier = Tiers[stake.TierId];

        if (tier.lockDays > 0) {
            uint256 lockEnd = stake.startTime + (tier.lockDays * period);
            require(block.timestamp >= lockEnd, "Investment period not over");
        }

        uint256 rewards = rewardsCalculator(msg.sender, stakeIndex);
        require(rewardPool >= rewards, "Insufficient reward pool");

        stakes[msg.sender][stakeIndex].isActive = false;
        stakes[msg.sender][stakeIndex].lastClaimed = block.timestamp;

        uint256 totalWithdrawal = stake.stakedAmount + rewards;

        rewardPool -= rewards;
        totalStaked -= stake.stakedAmount;

        uint256 withdrawTax = (rewards * taxRate) / taxDenominator;
        cztToken.transfer(devWallet, withdrawTax);
        totalTax += withdrawTax;

        cztToken.transfer(msg.sender, totalWithdrawal - withdrawTax);

        emit Withdrawal(msg.sender, stakeIndex, totalWithdrawal);
    }

    function rewardsCalculator(address user, uint256 stakeIndex) public view returns (uint256) {
        require(stakeIndex < stakes[user].length, "Stake does not exist");
        UserStake memory stake = stakes[user][stakeIndex];
        require(stake.isActive, "No active stake");

        Tier memory tier = Tiers[stake.TierId];

        uint256 from = stake.lastClaimed == 0 ? stake.startTime : stake.lastClaimed;
        uint256 to;

        if (tier.lockDays > 0) {
            uint256 lockEnd = stake.startTime + (tier.lockDays * period);
            to = block.timestamp < lockEnd ? block.timestamp : lockEnd;
        } else {
            to = block.timestamp;
        }

        uint256 elapsed = to > from ? to - from : 0;
        uint256 elapsedDays = elapsed / period;

        return (stake.stakedAmount * tier.dailyRatePPM * elapsedDays) / rewardsDenominator ;
    }

    //admin functions
    function getStakeCount(address user) external view returns (uint256) {
        return stakes[user].length;
    }

    function fundRewardPool(uint256 amount) external onlyOwner {
        cztToken.transferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
    }

    function setTaxRate(uint256 _rate) external onlyOwner {
        taxRate = _rate;
    }

    function updatePeriod(uint256 _period) external onlyOwner{
        period = _period;
    }

    function getStuckTokens() external onlyOwner {
        uint256 amount =  cztToken.balanceOf(address(this));
        cztToken.transfer(msg.sender, amount);
        
        emit WithdrawStuckTokens(msg.sender, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
