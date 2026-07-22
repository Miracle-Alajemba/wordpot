# WordPot Development & Build Guide

This document covers local setup, environment configuration, dependency installation, and production build commands across all components.

## Directory Structure Overview
* `/client`: React + Vite web frontend.
* `/server`: Express backend & word dictionary engine.
* `/contracts`: Hardhat Solidity smart contract suite.

---

## 1. Client Setup (`client/`)

### Dependencies & Scripts
```bash
cd client
npm install
```

### Key Commands
* **Development Server**: `npm run dev` (starts Vite on http://localhost:5173)
* **Production Build**: `npm run build` (outputs optimized bundle to `client/dist`)
* **Preview Build**: `npm run preview`

---

## 2. Server Setup (`server/`)

### Configuration
Create `server/.env` file with the following variables:
```env
PORT=3001
TREASURY_WALLET=0x...
WORDPOT_CONTRACT_ADDRESS=0x4302D510383C6be4a284759BB0616fc6ED57e9A1
CONTRACT_OPERATOR_PRIVATE_KEY=0x...
CELO_CHAIN_ID=42220
JOIN_PAYMENT_WEI=100000000000000000
JOIN_PAYMENT_DISPLAY=0.1
```

### Key Commands
```bash
cd server
npm install
npm run dev
```

---

## 3. Smart Contracts Setup (`contracts/`)

### Hardhat Commands
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Deployment Command
```bash
npx hardhat run scripts/deploy.js --network celo
```
