# WordPot Smart Contracts Architecture & Deployments

This document details the Solidity smart contracts deployed on Celo Mainnet powering WordPot's escrow, multiplayer prize pools, and daily reward distribution.

## Deployed Mainnet Contracts

| Contract Name | Address | Celo Explorer Link |
| :--- | :--- | :--- |
| **WordPot Arena Escrow** | `0x764b3f8761CEB44e6FFA6480484b706C3c3A8284` | [Celoscan Address](https://celoscan.io/address/0x764b3f8761CEB44e6FFA6480484b706C3c3A8284) |
| **Daily Challenge Pool** | `0x4302D510383C6be4a284759BB0616fc6ED57e9A1` | [Celoscan Address](https://celoscan.io/address/0x4302D510383C6be4a284759BB0616fc6ED57e9A1) |

---

## Core Smart Contract Interfaces

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWordPotArena {
    enum RoomStatus { Lobby, Active, Settled, Expired }

    event RoomCreated(bytes32 indexed roomId, address indexed host, uint256 entryFee);
    event PlayerJoined(bytes32 indexed roomId, address indexed player);
    event RoomSettled(bytes32 indexed roomId, uint256 totalPool, uint256 treasuryFee);

    function createRoom(bytes32 roomId, uint256 entryFee) external;
    function joinRoom(bytes32 roomId) external payable;
    function settleRoom(bytes32 roomId, address[] calldata winners, uint256[] calldata scores) external;
    function claimRefund(bytes32 roomId) external;
}
```

## Admin & Governance Functions

* `setOperator(address newOperator)`: Updates the backend operator address allowed to trigger match settlements.
* `setTreasury(address newTreasury)`: Updates the treasury destination wallet receiving protocol fee cuts.
* `withdrawEmergency()`: Contract owner safety function to pause or retrieve funds in case of critical upgrade migration.
