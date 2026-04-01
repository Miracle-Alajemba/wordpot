# WordPot MVP Spec

## Game Rules

- Entry fee: `0.1 cUSD`
- Round time: `60 seconds`
- Players per room: `2-5`
- Minimum word length: `3`
- Duplicate words are blocked across all players
- A player cannot reuse their own word
- Letters can only be used as many times as they appear in the source word

## Scoring

- 3 letters = 3 points
- 4 letters = 5 points
- 5 letters = 8 points
- 6+ letters = 12 points

## Reward Split

- 10% to treasury
- 90% shared proportionally by score

### Formula

`player payout = (player score / total room score) × reward pool`

If total room score is `0`, the round can refund players or roll to the next pot
depending on the final product decision. For MVP, refund is the safer rule.

## MVP Modes

1. Practice mode
2. Quick match
3. Leaderboard
