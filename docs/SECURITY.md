# WordPot Security Architecture & Anti-Cheat Specifications

WordPot uses multi-tiered security safeguards spanning front-end input validation, server-side authoritative state verification, and smart contract access control.

## Security Controls

### 1. Server-Authoritative Word Scoring
* Word submissions are **never** scored solely on the client.
* The Express server parses submitted words against `english-words.txt` and verifies character availability against the active room's `sourceWord`.

### 2. Anti-Bot Rate Limiting
* Maximum submission rate capped at **1 word per 500ms** per connection to prevent automated dictionary brute-force scripts.

### 3. Smart Contract Operator Access Control
* Settlement functions (`settleRoom`) are restricted via `onlyOperator` modifier in `WordPotArena.sol`.
* Prevents arbitrary unauthorized wallets from claiming room pools.

```solidity
modifier onlyOperator() {
    if (msg.sender != operatorAddress) revert UnauthorizedOperator();
    _;
}
```

### 4. Duplicate Submission Guard
* Maintains an active in-memory set `submittedWordsSet` per player per room to reject repeated word entries instantly.
