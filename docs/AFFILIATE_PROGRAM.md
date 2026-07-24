# WordPot Affiliate & Referral Program Specification

## Overview

The WordPot Affiliate & Referral Program incentivizes players and Web3 influencers to invite new players to compete in paid CELO rooms.

---

## Referral Mechanics

1. **Deterministic Referral Code**: Each wallet address generates a 6-character uppercase referral code based on the address trailing bytes.
2. **Invite Links**: Referral invite links follow the format:
   `https://wordpot.vercel.app/?ref=3A8284`
3. **Treasury Fee Split**:
   - Total Room Pot: `100%`
   - Winner Reward Pool: `90%`
   - Treasury Fee: `10%`
   - Referrer Cut: `20%` of Treasury Fee (`2%` of total room pot)
   - Net Treasury Cut: `80%` of Treasury Fee (`8%` of total room pot)

---

## Onchain & Backend Settle Execution

When a room is settled onchain, the backend operator wallet verifies if any player in the room joined via a referral link:
- If a valid referrer is attached, `calculateReferralCommission` allocates the 2% affiliate cut to the referrer wallet.
- Direct referral claims are logged to the database and sent as an automated transaction.
