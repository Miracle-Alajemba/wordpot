# WordPot

WordPot is a MiniPay-first multiplayer word game where players pay a small stake,
race to make valid words from a shared source word, and earn a share of the pot
based on performance.

## Planned MVP

- MiniPay-friendly mobile UI
- Practice mode
- Public quick match rooms
- 60-second rounds
- Duplicate-word blocking
- Real-time scoring
- Leaderboard
- Automatic score-based payout flow

## Project Structure

- `client/` React frontend
- `server/` Express backend and game logic
- `contracts/` payout contract notes and Solidity later
- `docs/` product and rules notes

## Current Status

Initial project scaffold is ready. Next we build:

1. practice mode UI
2. core word validation
3. multiplayer room logic
4. proportional payout flow

## Prize Model

- Standard room entry: `0.1 cUSD`
- Each player contributes to the room pot
- `10%` goes to treasury
- `90%` is shared across players based on score

### Payout Formula

Each player earns:

`(player score / total room score) × reward pool`

This means strong players earn more, but everyone who scores can still win
something.
