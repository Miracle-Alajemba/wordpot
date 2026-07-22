# Solidity Gas Optimization & EVM Efficiency Guide

To maximize profit margins and ensure sub-cent transaction fees on Celo Mainnet, `WordPotArena.sol` implements several EVM gas optimization techniques.

## Key Optimization Strategies

### 1. Custom Errors vs `require` Strings
Replaced legacy revert strings with custom errors (`error InsufficientPayment()`, `error RoomExpired()`). Saves ~100–250 gas per execution branch by avoiding string deployment encoding.

### 2. Tight Variable Packing (Storage Optimization)
Struct parameters are packed into contiguous 32-byte storage slots:
```solidity
struct Room {
    address host;          // 20 bytes
    uint32 maxPlayers;     // 4 bytes
    uint32 createdAt;      // 4 bytes
    uint8 status;          // 1 byte (fits into slot 0)
    uint256 entryFee;      // 32 bytes (slot 1)
}
```

### 3. Calldata Array Processing
Functions iterating over winner arrays (`settleRoom`) accept `calldata` parameters instead of `memory` parameters:
```solidity
function settleRoom(bytes32 roomId, address[] calldata winners, uint256[] calldata scores) external;
```
Direct `calldata` slicing avoids allocation overhead and reduces memory expansion gas.

### 4. Unchecked Loop Increments
Array iteration counters utilize `unchecked { ++i; }` blocks to bypass redundant safemath overflow checks when upper bounds are strictly validated.
