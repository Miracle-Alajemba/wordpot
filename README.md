# WordPot

WordPot is a MiniPay-first multiplayer word game where players join a live room,
make words from a shared source word, and compete for a score-based share of the
reward pool.

## Live App

- App: https://wordpot.vercel.app/
- Celo Mainnet Contract: `0x764b3f8761CEB44e6FFA6480484b706C3c3A8284`
- Explorer: https://celoscan.io/address/0x764b3f8761CEB44e6FFA6480484b706C3c3A8284

## Stack

- `client/`: React + Vite + viem
- `server/`: Node.js + Express
- `contracts/`: Solidity + Hardhat
- `network`: Celo Mainnet

## MiniPay Direction

WordPot is being built as a MiniPay-ready social game on Celo. The product
direction is focused on:

- MiniPay wallet connection and wallet-based player identity
- real onchain room entry activity on Celo Mainnet
- mobile-first multiplayer play for live room creation and repeat usage
- a simple game loop that can bring real users and real transactions onchain

## What Is Live Now

- Practice arena
- Quick match rooms
- Wallet-based player identity
- Shared room feed and scoreboard
- Tile tap plus typing input
- Beta onchain join flow from the lobby

## Onchain Plan

WordPot is being upgraded in two stages:

1. `Beta join flow`
   - players can send a real Celo mainnet transaction from the lobby
   - the tx hash is recorded on the room
   - this starts generating real onchain activity, fees, and transaction count

2. `Contract payout flow`
   - the `contracts/WordPotArena.sol` scaffold holds room entry fees
   - keeps a treasury cut
   - supports score-based reward claims after settlement

## Project Structure

- `client/` React frontend
- `server/` Express backend and room logic
- `contracts/` Solidity scaffold for escrow and claims
- `docs/` product and rules notes

## Prize Model

- Offchain game entry display: `0.1 cUSD`
- Treasury cut: `10%`
- Reward pool: `90%`
- Payout formula:

`(player score / total room score) × reward pool`

## Environment

Create `server/.env` from `server/.env.example` and set:

- `TREASURY_WALLET`
- `WORDPOT_CONTRACT_ADDRESS`
- `CELO_CHAIN_ID`
- `JOIN_PAYMENT_WEI`
- `JOIN_PAYMENT_DISPLAY`

If `WORDPOT_CONTRACT_ADDRESS` is not set yet, the lobby uses the treasury beta
join-payment flow while payout remains preview-only in the UI.

## Run Locally

### Client

```bash
cd client
npm install
npm run dev
```

### Server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

## Next Upgrade

- deploy `WordPotArena.sol`
- switch join flow from treasury beta to contract entry
- add claim reward transaction flow in the results screen
- move room sync from polling to sockets
