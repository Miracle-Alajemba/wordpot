# WordPot System Architecture Specification

## Overview

WordPot is a high-performance Web3 word puzzle platform built on **Celo Mainnet** and optimized for **Opera MiniPay**.

---

## High-Level Architecture Diagram

```
+-------------------------------------------------------------+
|                     React + Vite Frontend                   |
|  - Custom CSS Design Tokens & Glassmorphism               |
|  - Wagmi / Viem Web3 Wallet Adapter                         |
|  - Real-time Socket.IO Event Handlers                       |
+------------------------------+------------------------------+
                               |
                        HTTP / WebSockets
                               |
+------------------------------v------------------------------+
|                     Express + Node Server                   |
|  - Word Anagram Resolver (server/src/rounds.js)             |
|  - Quick-Match Matchmaking Queue                            |
|  - EIP-712 Signature Verification                           |
+------------------------------+------------------------------+
                               |
                     JSON-RPC Payout Calls
                               |
+------------------------------v------------------------------+
|                  WordPotArena.sol (Celo)                    |
|  - 0x764b3f8761CEB44e6FFA6480484b706C3c3A8284                |
|  - Proportional Prize Pool Escrow (90% Winner / 10% Cut)   |
+-------------------------------------------------------------+
```

---

## Core Components

1. **Frontend (`client/`)**: Mobile-first React single-page application.
2. **Server (`server/`)**: Express API & WebSocket backend handling room lifecycles, word validations, and operator payouts.
3. **Contracts (`contracts/`)**: Solidity smart contracts deployed on Celo Mainnet for room escrow and daily claim transactions.
