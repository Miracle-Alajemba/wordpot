# WordPot MVP Spec

## Core Game

- Entry display: `0.1 cUSD`
- Round time: `60 seconds`
- Players per room: `2-5`
- Identity: wallet address
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

## Onchain Upgrade Path

### Stage 1: Beta Join Flow

- players join a room in the app
- players send a real Celo mainnet transaction from the lobby
- the tx hash is recorded on the room feed and summary
- this generates real transaction count and fee activity for hackathon scoring

### Stage 2: Contract Flow

- `WordPotArena.sol` creates rooms with an entry fee
- players join the contract room with value
- owner settles using room scores
- players claim rewards onchain

## MVP Modes

1. Practice Arena
2. Quick Match Lobby
3. Live Room Chat Feed
4. Leaderboard
5. Beta Onchain Join Tracking
