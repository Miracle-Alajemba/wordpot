# WordPot Gameplay & Scoring Mechanics Specification

WordPot is a fast-paced multiplayer word puzzle game built around a shared source word mechanic.

## Word Validation Rules

1. **Length**: Words must be at least 3 letters and at most 15 letters long.
2. **Alphabet**: Only English letters (`[a-zA-Z]`) are allowed.
3. **Source Constraint**: Every letter in the submitted word must be present in the source word with matching frequency counts.
4. **Dictionary Check**: Submitted words must exist in the standard English word dictionary (`server/english-words.txt`).
5. **Uniqueness**: Submissions used by any player in the active room are locked and cannot be reused.

## Scoring System

Points are awarded dynamically based on word character length:

* 3 letters = 3 points
* 4 letters = 5 points
* 5 letters = 8 points
* 6+ letters = 12 points

## Reward Split Formula

For paid rooms on Celo, 90% of the total entry pool is distributed to players based on final score ratios:

$$\text{Player Payout} = \left( \frac{\text{Player Score}}{\text{Total Room Score}} \right) \times \text{Reward Pool}$$
