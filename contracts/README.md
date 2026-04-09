# Contracts

WordPot now includes a deployable escrow scaffold in [WordPotArena.sol](/home/miracle-alajemba/Documents/wordpot/contracts/WordPotArena.sol).

## What The Contract Does

1. holds room entry fees
2. keeps the treasury cut
3. stores player scores after settlement
4. lets players claim rewards proportionally

## Setup

Copy `.env.example` to `.env` inside `contracts/` and set:

- `TREASURY_WALLET`
- `DEPLOYER_PRIVATE_KEY`
- optional RPC URLs

## Commands

```bash
cd contracts
npm install
npm run compile
npm run deploy:alfajores
```

When you are happy with the flow, deploy to mainnet:

```bash
npm run deploy:mainnet
```

After deployment:

1. copy the deployed address
2. set `WORDPOT_CONTRACT_ADDRESS` in `server/.env`
3. restart the server
4. wire the client join flow to `joinRoom()` instead of treasury beta payment
