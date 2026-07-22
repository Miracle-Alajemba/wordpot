# Reward Distribution & Treasury Split Specifications

In multiplayer paid matches, entry fees staked by players form the room reward pool. Payouts are distributed proportionally based on each player's final relative score.

## Reward Distribution Formula

Let $N$ be the total number of players in the room, $E$ be the entry fee per player, and $S_i$ be the points scored by player $i$.

1. **Total Room Staked Pool**:
   $$\text{Pool}_{\text{total}} = N \times E$$

2. **Treasury Protocol Fee (10%)**:
   $$\text{Fee}_{\text{treasury}} = \text{Pool}_{\text{total}} \times 0.10$$

3. **Distributable Prize Pool (90%)**:
   $$\text{Pool}_{\text{prize}} = \text{Pool}_{\text{total}} \times 0.90$$

4. **Individual Player Payout**:
   $$\text{Payout}_i = \left( \frac{S_i}{\sum_{j=1}^{N} S_j} \right) \times \text{Pool}_{\text{prize}}$$

---

## Treasury Protocol Revenue

Treasury fees are automatically forwarded to the designated `TREASURY_WALLET` during contract settlement (`settleRoom`). Revenue funds server infrastructure, daily challenge liquidity, and seasonal leaderboard prizes.
