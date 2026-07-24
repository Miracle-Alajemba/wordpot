# WordPot Leaderboard Seasons & Bonus Payout Specification

## Overview

WordPot runs weekly leaderboard seasons starting every Monday at 00:00 UTC and ending Sunday at 23:59 UTC.

---

## Weekly Prize Pool & Distribution

At the conclusion of each weekly season, a fixed bonus prize pool (e.g. 1.75 CELO) is distributed directly to the top 3 leaderboard players based on total score.

### Payout Ratio (4:2:1)

| Rank | Score Share | Bonus Amount (1.75 CELO Pool) |
|---|---|---|
| **1st Place** 🥇 | 4/7 (57.14%) | 1.00 CELO |
| **2nd Place** 🥈 | 2/7 (28.57%) | 0.50 CELO |
| **3rd Place** 🥉 | 1/7 (14.29%) | 0.25 CELO |

---

## Execution Script

Weekly payouts are calculated by `server/src/season-rewards.js` and dispatched by the backend operator key.
