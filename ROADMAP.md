# ABC Lottery System — Build Roadmap

Design-first blueprint. Nothing here is executed yet. Three concurrent tracks: **Smart Contract**, **Backend Server**, and **Vite Frontend**.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Vite Frontend                               │
│            React + wagmi + viem + @tanstack/react-query              │
│         (Buy ticket · live round state · draw reveal · claim)        │
└────────────────┬─────────────────────────────┬───────────────────────┘
                 │                             │
          REST + WebSocket              ethers.js / wagmi
       (indexed data, fast)        (balances, withdrawals, txs)
                 │                             │
┌────────────────▼──────────────┐   ┌──────────▼──────────────────────┐
│      Node.js Backend          │   │      Lottery Smart Contract      │
│      Express · node-cron      │   │      Solidity · Sepolia          │
│                               │   │                                  │
│  ┌─────────┐   ┌───────────┐  │   │  ┌──────────┐  ┌─────────────┐  │
│  │  REST   │   │ WebSocket │  │   │  │  Round   │  │ Chainlink   │  │
│  │  /api/* │   │ broadcast │  │   │  │  State   │  │  VRF V2.5   │  │
│  └────▲────┘   └─────▲─────┘  │   │  └──────────┘  └─────────────┘  │
│       │              │        │   │  ┌──────────┐  ┌─────────────┐  │
│  ┌────┴──────────────┴─────┐  │   │  │  Prize   │  │  Rollover   │  │
│  │   Prisma ORM (reads)    │  │   │  │  Logic   │  │    Pool     │  │
│  └────────────▲────────────┘  │   │  └──────────┘  └─────────────┘  │
│               │ read          │   └──────────────────────▲───────────┘
│  ┌────────────┴────────────┐  │                          │
│  │   PostgreSQL Database   │  │              owner-signed txs via
│  │                         │  │              ethers Wallet (signer.js)
│  │  Round · Ticket ·       │  │              (requestDraw, startRound)
│  │  ChainEvent             │  │                          │
│  └────────────▲────────────┘  │   ┌──────────────────────┴───────────┐
│               │ write         │   │      Chainlink VRF Oracle        │
│  ┌────────────┴────────────┐  │   │  (off-chain randomness provider) │
│  │  Chain Indexer          ◄──┼───┤  fulfillRandomWords callback     │
│  │  (listener.js)          │  │   └──────────────────────────────────┘
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │  Cron Scheduler         │  │
│  │  (jobs/scheduler.js)    │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

**Data flow rule:** The contract is the financial source of truth. The server's Postgres DB is a read-optimised index of on-chain events — it is never written to directly by users, only by the indexer listening to chain events. The frontend reads indexed data from the server for speed, and reads balances/pending withdrawals directly from the contract for trust.

---

## Track A — Smart Contract

### A1. Project Scaffold
- `npx hardhat init` — choose TypeScript or JS project
- Install: `@chainlink/contracts`, `@openzeppelin/contracts`, `hardhat-gas-reporter`, `dotenv`
- Configure `hardhat.config.js` for Sepolia + local Hardhat node
- `.env`: `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `VRF_SUBSCRIPTION_ID`
- Add `.env` to `.gitignore` immediately

### A2. Core Contract Structure
File: `contracts/Lottery.sol`

```solidity
// State variables (design sketch)
uint256 public roundId;
uint256 public ticketPrice;
address public owner;
uint256 public ownerFeePercent;          // e.g. 10 = 10%
RoundState public state;                 // OPEN | DRAWING | CLOSED

mapping(uint256 => Ticket[]) public roundTickets;
mapping(uint256 => uint8[7]) public winningNumbers;
mapping(address => uint256) public pendingWithdrawals;
uint256 public rolloverPool;

struct Ticket {
    address player;
    uint8[7] numbers;
}

enum RoundState { OPEN, DRAWING, CLOSED }
```

Inherits: `VRFConsumerBaseV2Plus`, `ReentrancyGuard`, `Ownable`

### A3. Player Functions
- `buyTicket(uint8[7] calldata numbers) external payable`
  - Require: state == OPEN, msg.value == ticketPrice
  - Validate: all numbers 1–49, no duplicates within the ticket
  - Push to `roundTickets[roundId]`, emit `TicketPurchased(player, roundId, numbers)`

### A4. Chainlink VRF Integration
**Approach: VRF V2.5, subscription model**

Setup (one-time, before deploy):
1. Create subscription at vrf.chain.link (Sepolia)
2. Fund with LINK
3. After deploy, register contract address as a consumer on the subscription

Contract:
- Constructor args: `subscriptionId`, `vrfCoordinator`, `keyHash`, `callbackGasLimit`
- `requestConfirmations = 3` (minimum for Sepolia)
- `requestDraw() external onlyOwner` — requires state == OPEN, sets state to DRAWING, calls `requestRandomWords`, emits `DrawRequested(roundId, requestId)`
- `fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override`
  - Derives 7 unique numbers from `randomWords[0]` (see A5)
  - Stores `winningNumbers[roundId]`
  - Calls internal `_distributePrizes()`
  - Sets state to CLOSED, emits `DrawComplete(roundId, winningNumbers[roundId])`

### A5. Deriving 7 Unique Numbers (1–49) from One Random Word

Chainlink returns one `uint256`. Re-hash to get 7 unique picks:

```solidity
// Design sketch — not final code
function _deriveNumbers(uint256 seed) internal pure returns (uint8[7] memory) {
    uint8[7] memory nums;
    uint8 count = 0;
    uint256 s = seed;
    while (count < 7) {
        s = uint256(keccak256(abi.encode(s, count)));
        uint8 candidate = uint8((s % 49) + 1);
        bool duplicate = false;
        for (uint8 i = 0; i < count; i++) {
            if (nums[i] == candidate) { duplicate = true; break; }
        }
        if (!duplicate) { nums[count] = candidate; count++; }
    }
    return nums;
}
```

Numbers are stored in draw order, not sorted. Matching is **positional** — ticket index N must equal winning number index N.

### A6. Prize Distribution
Called internally after `fulfillRandomWords`:

```
1. Deduct ownerFeePercent from total pool → pendingWithdrawals[owner]
2. Remaining pool = totalPool - ownerFee + rolloverPool
3. For each tier (2–7 matches):
   a. Count winners in that tier
   b. If zero winners → add tier's share to rolloverPool for next round
   c. If winners → split tier share equally, add to each winner's pendingWithdrawals
4. Reset rolloverPool to accumulated value only
```

Prize table (from README):

| Matches | Pool Share |
|---------|-----------|
| 2 | 5% |
| 3 | 10% |
| 4 | 15% |
| 5 | 20% |
| 6 | 20% |
| 7 | 30% |

### A7. Admin Functions (owner only)
- `startRound() external onlyOwner` — requires state == CLOSED, increments roundId, sets state to OPEN, emits `RoundOpened(roundId, rolloverPool)`
- `requestDraw() external onlyOwner` — see A4
- `withdraw() external nonReentrant` — player claims from pendingWithdrawals
- `ownerWithdraw() external onlyOwner nonReentrant` — owner claims fee

### A8. Tests
File: `test/Lottery.test.js`

Use `VRFCoordinatorV2_5Mock` from `@chainlink/contracts/mocks` to simulate VRF callbacks locally.

Test groups:
1. Ticket validation (bad numbers, wrong fee, wrong round state, owner cannot buy)
2. Full round simulation: buy tickets → mock VRF → check winning numbers stored
3. Prize distribution correctness for each tier (0 through 7 matches)
4. Rollover: empty tier shares carry to next round
5. Re-entrancy guard on `withdraw()`
6. Admin access control (non-owner cannot call `requestDraw`, `startRound`)

### A9. Deployment Script
File: `scripts/deploy.js`
- Deploy with: `ticketPrice`, `subscriptionId`, `vrfCoordinator` (Sepolia address), `keyHash`
- After deploy: add contract to VRF subscription as consumer
- Verify: `npx hardhat verify --network sepolia <address> <constructor args>`

---

## Track B — Backend Server

**Role:** The server is a chain indexer + event relay. It never holds funds or decides game state — that is the contract's job. It exists to make the frontend fast and to automate owner actions (triggering the draw).

### B1. Folder Structure

```
server/
  index.js              # Express entry point, mounts routes, starts WS server
  config.js             # env vars: RPC_URL, CONTRACT_ADDRESS, ABI path, DB_URL

  db/
    schema.prisma        # Prisma schema (Round, Ticket, Event)
    client.js            # Prisma client singleton

  chain/
    provider.js          # ethers.WebSocketProvider (Alchemy/Infura WSS)
    contracts.js         # Contract instance with ABI
    listener.js          # Listens to contract events, writes to Postgres
    signer.js            # Owner wallet for admin txs (private key from .env)

  routes/
    rounds.js            # /api/rounds, /api/rounds/:id
    players.js           # /api/players/:address/tickets
    admin.js             # POST /admin/start-round, POST /admin/request-draw

  services/
    roundService.js      # Reads from DB, formats for API responses
    playerService.js     # Ticket history, win checks

  ws/
    server.js            # ws WebSocket server
    broadcast.js         # Push typed events to all connected clients

  jobs/
    scheduler.js         # node-cron: triggers requestDraw on schedule
```

### B2. Database Schema (Prisma)

```prisma
model Round {
  id             Int      @id        // matches on-chain roundId
  state          String              // OPEN | DRAWING | CLOSED
  prizePool      String              // wei, stored as string to avoid BigInt loss
  rollover       String
  winningNumbers Int[]
  openedAt       DateTime?
  drawnAt        DateTime?
  tickets        Ticket[]
}

model Ticket {
  id        Int      @id @default(autoincrement())
  roundId   Int
  player    String                   // lowercase wallet address
  numbers   Int[]
  txHash    String   @unique
  createdAt DateTime @default(now())
  round     Round    @relation(fields: [roundId], references: [id])

  @@index([player])
  @@index([roundId])
}

model ChainEvent {
  id        Int      @id @default(autoincrement())
  type      String                   // TICKET_PURCHASED | DRAW_REQUESTED | DRAW_COMPLETE | ROUND_OPENED
  roundId   Int
  txHash    String   @unique
  payload   Json
  createdAt DateTime @default(now())
}
```

### B3. Chain Indexer (`listener.js`)

Connects via WebSocket provider. For each event, writes to DB then broadcasts to WebSocket clients.

| Contract Event | DB Write | WS Broadcast |
|---------------|----------|--------------|
| `TicketPurchased(player, roundId, numbers)` | Insert Ticket row | `TICKET_PURCHASED` |
| `DrawRequested(roundId, requestId)` | Update Round state → DRAWING | `DRAW_REQUESTED` |
| `DrawComplete(roundId, winningNumbers)` | Update Round state → CLOSED, store numbers | `DRAW_COMPLETE` |
| `RoundOpened(roundId, rollover)` | Insert Round row, state OPEN | `ROUND_OPENED` |

On server startup: replay recent missed events using `queryFilter` with `fromBlock` = last processed block (store in DB).

### B4. REST API Endpoints

```
GET  /api/rounds/current
     → { roundId, state, prizePool, ticketCount, rollover }

GET  /api/rounds/:id
     → round details + winningNumbers (if CLOSED)

GET  /api/rounds/:id/tickets
     → paginated list of tickets for a round

GET  /api/players/:address/tickets
     → all tickets bought by address across rounds

GET  /api/players/:address/wins
     → rounds where player won + amounts (calculated off-chain for display)

POST /admin/start-round           (protected — owner API key header)
POST /admin/request-draw          (protected — owner API key header)
```

### B5. WebSocket Events (pushed to frontend)

```json
{ "type": "TICKET_PURCHASED", "roundId": 3, "player": "0x...", "numbers": [1,7,14,22,33,40,49] }
{ "type": "DRAW_REQUESTED",   "roundId": 3 }
{ "type": "DRAW_COMPLETE",    "roundId": 3, "winningNumbers": [4,17,23,31,38,42,49] }
{ "type": "ROUND_OPENED",     "roundId": 4, "rollover": "500000000000000000" }
```

### B6. Cron Job (`scheduler.js`)

```
Owner signs txs using a wallet loaded from PRIVATE_KEY env var.
Schedule (example): every Sunday 20:00 UTC
  → call requestDraw() on contract
  → log tx hash, wait for 2 confirmations
  → server receives DrawComplete event via listener, triggers ROUND_OPENED after manual or auto startRound
```

---

## Track C — Vite Frontend

Built concurrently. Uses mock data and a local Hardhat node until Sepolia deploy.

### C1. Scaffold & Structure

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install wagmi viem @tanstack/react-query ethers
npm install connectkit   # wallet modal
```

```
frontend/src/
  components/
    TicketForm.jsx         # 7-number picker grid (1–49)
    RoundStatus.jsx        # Pool size, ticket count, state badge, countdown
    WinningNumbers.jsx     # Animated draw reveal (numbers appear one by one)
    TicketCard.jsx         # Single ticket display with match highlighting
    PastRounds.jsx         # Table: round ID, date, pool, jackpot winner
    ClaimBanner.jsx        # Shows claimable amount + claim button

  hooks/
    useLottery.js          # wagmi contract reads (ticketPrice, state, pendingWithdrawals)
    useRoundEvents.js      # WebSocket connection, dispatches to React state
    usePastRounds.js       # fetches /api/rounds with react-query

  pages/
    Home.jsx               # RoundStatus + TicketForm
    MyTickets.jsx          # Player's tickets this round + claim if won
    Results.jsx            # WinningNumbers + PastRounds

  lib/
    contract.js            # ABI import + deployed address constant
    wsClient.js            # WebSocket singleton
    format.js              # wei → ETH formatting helpers
```

### C2. Wallet Connection
- `ConnectKitProvider` wraps the app
- `useAccount`, `useNetwork` from wagmi
- Network guard: show warning if not on Sepolia (chainId 11155111)
- Display connected address truncated: `0x1234...abcd`

### C3. Buy Ticket Flow
1. `TicketForm` renders a 7x7 number grid (1–49), player clicks to select
2. Local validation: exactly 7 selected, all unique (mirrors contract validation)
3. On submit: `useContractWrite` calls `buyTicket(numbers)` with `value: ticketPrice`
4. Show three states: idle → pending tx → confirmed
5. On confirmation: optimistically add ticket to MyTickets view, re-fetch from `/api/players/:address/tickets`

### C4. Live Round State
- Initial load: `GET /api/rounds/current` via react-query
- `useRoundEvents` connects WebSocket on mount, updates React state on each event
- `RoundStatus` shows: round ID, prize pool (ETH), tickets sold, state pill (green OPEN / orange DRAWING / grey CLOSED)

### C5. Draw Results
- `DRAW_COMPLETE` WebSocket event triggers `WinningNumbers` animation
- Each number drops in sequentially with a 400ms delay
- Player's own tickets shown below with matching positions highlighted green

### C6. Claim Winnings
- `useLottery` reads `pendingWithdrawals[connectedAddress]` directly from contract
- `ClaimBanner` appears at top of page when value > 0
- Calls `withdraw()` via wagmi `useContractWrite`
- Shows pending → success state, clears banner on confirmation

---

## Concurrent Sprint Plan

| Sprint | Contract (A) | Server (B) | Frontend (C) |
|--------|-------------|------------|--------------|
| **1** | A1 scaffold, A2 state vars + structs | B1 scaffold, Prisma schema, stub REST endpoints | C1 scaffold, wallet connect, network guard |
| **2** | A3 `buyTicket`, events, local tests | B3 indexer on local Hardhat node, DB writes | C3 ticket form UI, mock contract data |
| **3** | A4 VRF integration, A5 number derivation | B5 WebSocket server + broadcast | C4 live round state via WebSocket |
| **4** | A6 prize distribution, A7 rollover | B4 full REST API from DB | C5 draw results animation, match highlighting |
| **5** | A8 admin functions, A9 full test suite | B6 cron scheduler, admin endpoints | C6 claim UI, MyTickets page |
| **6** | A10 Sepolia deploy + Etherscan verify | Point server at Sepolia, event replay on startup | Point frontend at deployed contract + server |
| **7** | Gas optimisation, audit checklist | Rate limiting, error handling, reconnect logic | Mobile layout, loading/error states, polish |

**Integration checkpoints:**
- End of Sprint 2: full round simulation works on local Hardhat node with all three layers talking to each other
- End of Sprint 5: complete feature-complete on local node before touching Sepolia
- Sprint 6: deploy only after Sprint 5 integration is stable

---

## Open Design Decisions (Answer Before Sprint 1)

| # | Decision | Options | Recommendation |
|---|----------|---------|---------------|
| 1 | **Matching rule** | Positional (index must match) vs Set (any match counts) | README says positional — confirm; set-based is more familiar to lottery players |
| 2 | **Sorted numbers** | Store winning numbers sorted ascending vs in draw order | Sort them — makes the UI simpler and matching logic cleaner |
| 3 | **Ticket duplicates** | Allow duplicate numbers on one ticket vs forbid | Forbid — enforce in contract and UI |
| 4 | **Max tickets per round** | Unlimited vs capped | Cap at e.g. 1000 to bound VRF callback gas |
| 5 | **Round duration** | Time-based (block timestamp closes round) vs owner triggers close | Owner-triggered for now (simpler), upgrade later |
| 6 | **Owner fee %** | Not in README | Decide — 5–10% is typical; hardcode in constructor |
| 7 | **VRF callback gas limit** | Depends on max tickets | Calculate: distribution loop over 1000 tickets costs ~$X gas; set limit accordingly |

---

## Key Dependencies

| Package | Track | Purpose |
|---------|-------|---------|
| `hardhat` ^2.22 | Contract | Dev + test framework |
| `@chainlink/contracts` ^1.2 | Contract | VRF V2.5 consumer base + mock |
| `@openzeppelin/contracts` ^5.x | Contract | ReentrancyGuard, Ownable |
| `ethers` ^6.x | Server | Provider, signer, contract interaction |
| `express` ^4.x | Server | REST API |
| `ws` ^8.x | Server | WebSocket server |
| `prisma` ^5.x | Server | ORM + migrations |
| `@prisma/client` ^5.x | Server | DB queries |
| `node-cron` ^3.x | Server | Draw scheduling |
| `vite` ^5.x | Frontend | Bundler |
| `wagmi` ^2.x | Frontend | Wallet + contract hooks (uses viem) |
| `viem` ^2.x | Frontend | Required peer dep for wagmi |
| `connectkit` ^1.x | Frontend | Wallet modal UI |
| `@tanstack/react-query` ^5.x | Frontend | Server state / caching |

---

## Security Checklist (Design Phase)

- `PRIVATE_KEY` only in `.env`, never committed — add to `.gitignore` on day one
- `nonReentrant` on every function that moves Ether
- Pull pattern for withdrawals — never loop-push Ether to winners
- `fulfillRandomWords` callable only by VRF coordinator (inherited check)
- No `block.timestamp` or `blockhash` for randomness — Chainlink VRF only
- Admin endpoints protected by API key, not just obscurity
- Validate all user input at contract boundary (numbers range, count, fee)

---

*Draft — last updated 2026-06-08*
