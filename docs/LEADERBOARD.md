# Leaderboard & Seasonal Ranking Specifications

WordPot maintains global player leaderboards to track performance, reward loyal competitors, and drive retention.

## Leaderboard Data Schema (`server/leaderboard-seasons.json`)

```json
{
  "currentSeason": 1,
  "seasonEndsAt": 1785283200,
  "rankings": [
    { "address": "0x1234...5678", "totalPoints": 1420, "gamesWon": 18 },
    { "address": "0x8765...4321", "totalPoints": 1150, "gamesWon": 14 }
  ]
}
```

## Ranking Algorithms

1. **Total Points**: Sum of all valid word points scored across multiplayer matches and daily challenges during the active season.
2. **Tie-Breaker**: In the event of equal points, the player with the higher win ratio (`gamesWon / gamesPlayed`) takes priority.

## Season Rewards & Payout Automation

At the end of each weekly cycle (Sunday 23:59 UTC):
* **1st Place**: 1.00 CELO
* **2nd Place**: 0.50 CELO
* **3rd Place**: 0.25 CELO

Rewards are dispatched automatically via the operator key script `server/scripts/distributeSeasonRewards.js`.
