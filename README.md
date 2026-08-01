# Lucky Seven — On-Chain Lottery

A decentralised lottery dApp on Ethereum where players pick 7 numbers, buy a ticket in USDC, and get paid instantly if their numbers match the draw.

---

## Project Structure

```
Lottery_System/
├── packages/
│   ├── hardhat/        — Smart contracts, deploy scripts, tests
│   ├── frontend/       — React + Vite UI
│   └── backend/        — Off-chain server (in progress)
```

---

## How It Works

1. **Pick your numbers** — Choose 7 numbers from 1–49
2. **Buy a ticket** — Pay a fixed entry fee in USDC
3. **Match the draw** — Winning numbers are drawn on-chain via Chainlink VRF

### Prize Tiers

| Matches | Reward |
|---------|--------|
| 2       | 5%     |
| 3       | 10%    |
| 4       | 15%    |
| 5       | 20%    |
| 6       | 20%    |
| 7       | 30%    |

- Multiple winners in a tier split the reward equally
- Unclaimed prizes roll over into the next round
- A small platform fee is taken by the contract owner

---

## Smart Contracts (`packages/hardhat`)

### Contracts

| File | Description |
|------|-------------|
| `Lottery4.sol` | Current production contract — full round lifecycle, Chainlink VRF randomness, USDC payments, prize distribution, rollover |
| `WinningNumbers.sol` | Chainlink VRF consumer that requests and stores verifiable random numbers |
| `Lottery1–3.sol` | Earlier iterations (kept for reference) |

### Key Dependencies

- **Hardhat** `^2.19.4` — development environment
- **Chainlink Contracts** `^1.5.0` — VRF for on-chain randomness
- **OpenZeppelin** `^4.2.0` — access control, upgradeable proxies
- **Ethers.js** `^6.16.0` — contract interaction
- **Sepolia Testnet** — current deployment target

### Scripts

| Script | Purpose |
|--------|---------|
| `deploy.js` | Deploy contracts to Sepolia |
| `configure.js` | Post-deploy configuration (set VRF params, fee, etc.) |
| `exportArtifacts.js` | Export ABI + addresses for frontend consumption |
| `interactive.js` | Manual contract interaction via CLI |

### Running the Contracts

```bash
cd packages/hardhat
npm install

# Compile
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

---

## Frontend (`packages/frontend`)

### Tech Stack

- **Vite 5** + **React 18** (JavaScript)
- **Tailwind CSS v3**
- **Wagmi v2** + **Reown AppKit** — wallet connection (WalletConnect, MetaMask, Brave Wallet)
- **React Router v6** — client-side routing

### Pages

| Route | Page | Status |
|-------|------|--------|
| `/` | Home — hero, how-to-play, prize tiers | ✅ Done |
| `/dashboard` | Live Round — number picker, round stats, draw results | ✅ Done |
| `/results` | Round History — table of past draws | ✅ Done |
| `/my-tickets` | My Tickets — player ticket history with match highlights | ✅ Done |

### Live Round States

The dashboard renders different UI depending on the contract state:

| Status | UI |
|--------|----|
| `OPEN` | Number picker grid — buy a ticket |
| `DRAW_IN_PROGRESS` | Spinner — draw is running |
| `TICKET_SUBMITTED` | Confirmation — ticket balls displayed |
| `WAITING` | Next round not started yet |
| `PAUSED` | Contract paused — withdrawals still available |
| `DRAW_COMPLETE_WON` | Results card with matched balls + withdraw |
| `DRAW_COMPLETE_LOST` | Results card showing no match |

> All dashboard data (round number, prize pool, countdown, draw results) is currently mocked. Contract wiring via Wagmi `useReadContract` is the next milestone.

### Running the Frontend

```bash
cd packages/frontend
npm install
npm run dev
```

Create a `.env` file:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

---

## Roles

### Player
- Buys tickets by submitting 7 numbers + entry fee
- Receives payout automatically if numbers match
- Can withdraw unclaimed rewards

### Contract Owner
- Deploys and configures the contract
- Triggers draw via Chainlink Automation or manual call
- Receives a platform fee per round
- Cannot buy tickets or influence winning numbers

---

## Security Notes

- Randomness is provided by **Chainlink VRF** — not manipulable by the owner
- Contract is not audited — do not use in production with real funds
- Deployed on **Sepolia testnet** only

---

## License

Open-source, for educational and development purposes.
