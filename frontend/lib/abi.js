const ABI = [
  {"inputs":[],"name":"currentRoundId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"entryFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"rolloverPool","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"rounds","outputs":[{"internalType":"bool","name":"active","type":"bool"},{"internalType":"bool","name":"drawRequested","type":"bool"},{"internalType":"bool","name":"drawn","type":"bool"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"pot","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint8[7]","name":"numbers","type":"uint8[7]"}],"name":"buyTicket","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"hasEntered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"pendingRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"withdrawReward","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"getWinningNumbers","outputs":[{"internalType":"uint8[7]","name":"","type":"uint8[7]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],"name":"getRoundWinningNumbers","outputs":[{"internalType":"uint8[7]","name":"","type":"uint8[7]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],"name":"getRoundTicketCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
];

export default ABI;
