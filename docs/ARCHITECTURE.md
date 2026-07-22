# WordPot Web3 System Architecture

WordPot utilizes a hybrid Web3 architecture that combines client-side reactivity, server-side room management & word validation, and EVM smart contract escrow on the Celo blockchain.

```
+-----------------------------------------------------------------------+
|                           REACT FRONTEND                              |
|   (Vite + React Hooks + Wagmi / Viem Injected Wallet Connection)     |
+-----------------------------------+-----------------------------------+
                                    |
            REST APIs / WS Events   |  Onchain Transactions
                                    v  (Join Room / Claim Reward)
+-----------------------------------+-----------------------------------+
|                        NODE.JS SERVER ENGINE                          |
|   - Room Management & Lifecycle Timers                                |
|   - English Trie Dictionary Validation                                |
|   - Operator Key Payout Signer                                        |
+-----------------------------------+-----------------------------------+
                                    |
                                    v Read/Write Contract State
+-----------------------------------+-----------------------------------+
|                     CELO SMART CONTRACT LAYER                         |
|   - WordPotArena.sol Escrow & Treasury (90% / 10% Split)              |
|   - Daily Challenge Pool Contract                                     |
+-----------------------------------------------------------------------+
```

## System Components

### 1. Frontend Layer (`client/`)
* **Framework**: React 18 with Vite build system.
* **State Management**: React state, custom hooks (`useWallet`, `useGameRoom`), and local storage caching.
* **Blockchain Interactivity**: `viem` and `wagmi` library adapters for connecting with Celo wallets (MiniPay, Metamask, Valora).

### 2. Backend Server (`server/`)
* **Framework**: Express.js server on Node.js environment.
* **Word Engine**: Memory-cached fast lookup dictionary (`english-words.txt`) with frequency scoring.
* **Security Layer**: Input sanitization, score rate-limiting, and operator wallet key administration.

### 3. Smart Contract Layer (`contracts/`)
* **Language**: Solidity `^0.8.20` targeting EVM compatibility.
* **Deployments**: Celo Mainnet.
* **Contracts**:
  * `WordPotArena.sol`: Room entry fee escrow and winner payout settlement.
  * Daily Challenge Contract: Once-per-day target reward pool payout.
