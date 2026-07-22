# Daily Challenge & Reward Distribution Specification

The Daily Challenge allows players to participate in one free timed round per wallet every 24 hours to earn real CELO rewards upon achieving the target score threshold.

## Rules & Requirements

1. **Free Entry**: No initial transaction fee or CELO staking required to start.
2. **One Play Per Wallet**: Restricted to 1 attempt per wallet per UTC day.
3. **Score Target**: Player must reach or exceed `30 Points` within the 60-second game timer.
4. **Reward Amount**: `0.01 CELO` per successful claim.
5. **Contract Faucet**: Payouts are dispatched directly from the Daily Challenge contract (`0x4302D510383C6be4a284759BB0616fc6ED57e9A1`).

---

## Technical Claim Flow

```
[Player completes challenge] -> [Score >= 30 Verified] -> [Server Checks 24h Cooldown]
                                                                  |
                                                                  v
[CELO Transferred to Player] <- [Operator Calls Contract] <- [Signature Verified]
```

## Anti-Abuse & Rate Limiting

* **Server-side Cooldown Storage**: Tracks claimed timestamp indexed by wallet address in database/memory.
* **Onchain Nullifier**: Smart contract records `hasClaimedToday[walletAddress][dateIndex] = true` to prevent double-spending even if server state is reset.
* **Minimum Word Length**: Only words with length $\ge 3$ count towards the target score.
