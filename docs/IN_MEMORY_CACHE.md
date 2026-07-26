# In-Memory TTL Cache Engine Specification

The WordPot server incorporates a high-performance in-memory key-value cache engine (`TtlCacheEngine`) designed to minimize database query latency and improve throughput during high concurrency.

## Architecture

* **Data Structure**: `Map<string, { value: *, expiresAt: number }>`
* **Default TTL**: 10 seconds.
* **Metrics Tracked**:
  * `size`: Active stored keys count.
  * `hits`: Total successful cache retrievals.
  * `misses`: Cache lookup misses or expired keys.
  * `hitRatioPercent`: Calculated hit percentage.

## Usage Example

```javascript
import { ttlCache } from "../src/utils/cache.js";

// Store value with 10-second TTL
ttlCache.set("leaderboard:season:1", leaderboardData, 10);

// Retrieve cached item
const cachedData = ttlCache.get("leaderboard:season:1");
if (cachedData) {
  return res.json(cachedData);
}
```

## Invalidation Policy

Cache keys are invalidated when:
1. The TTL timer expires (`Date.now() > item.expiresAt`).
2. A new game settles (`ttlCache.del("leaderboard:season:1")`).
3. Server receives a flush signal (`ttlCache.flush()`).
