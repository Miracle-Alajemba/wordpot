# WordPot Core Gameplay Mechanics & Scoring Matrix

WordPot is a fast-paced vocabulary game where players race against a timer to construct words using letters from an assigned source word.

## Game Loop Overview

1. **Source Word Assignment**: Each player is presented with a 7–9 letter source word (e.g. `SPLENDID`).
2. **60-Second Round**: Players type or tap letter tiles to assemble valid English words.
3. **Real-time Scoring**: Valid submissions instantly increment score based on word length.
4. **Final Settlement**: Round ends when time hits zero. Scores determine rank and reward pool shares.

---

## Scoring Table

| Word Length | Points Awarded | Example (from `SPLENDID`) |
| :--- | :--- | :--- |
| **3 Letters** | `3 Points` | `PEN`, `LIP`, `DEN` |
| **4 Letters** | `5 Points` | `LEND`, `LINE`, `SIDE` |
| **5 Letters** | `8 Points` | `SPINE`, `SPEND`, `PLEAD` |
| **6+ Letters**| `12 Points`| `SPLENDID`, `LENDIES` |

---

## Submission & Validation Constraints

* **Minimum Length**: Words shorter than 3 letters are rejected.
* **No Duplicates**: A word already scored in the current round cannot be submitted twice.
* **Character Frequency Constraint**: Candidate word cannot consume more instances of any letter than present in the source word.
