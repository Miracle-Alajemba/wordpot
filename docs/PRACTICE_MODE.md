# Practice Arena Specifications

The Practice Arena provides a free-to-play, zero-stake single-player environment allowing players to train vocabulary skills without connecting a wallet or spending CELO.

## Features & Loop

1. **No Wallet Required**: Players can start a practice round immediately from the main menu.
2. **Infinite Rounds**: Unlimited replayability with randomized source words.
3. **Local High Score Storage**: Personal best scores are cached locally via `localStorage.setItem('wordpot_practice_pb', score)`.
4. **Full Dictionary Engine**: Uses the exact same scoring matrix and validation logic as paid rooms.

---

## Technical Configuration

```javascript
const practiceConfig = {
  isPractice: true,
  roundDurationSeconds: 60,
  requiresWallet: false,
  contractInteraction: false
};
```
