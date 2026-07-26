# In-Memory Rate Limiter Technical Specification

WordPot incorporates a zero-dependency memory rate limiter (`MemoryRateLimiter`) to protect server endpoints against abusive request volumes.

## Architecture

* **Storage**: In-Memory JavaScript `Map<string, { count: number, resetTime: number }>`
* **Window Duration**: Configurable (default: 60,000ms / 1 minute).
* **Threshold**: Configurable (default: 100 requests / window).

## Usage Example

```javascript
import { rateLimiter } from "../src/utils/rate-limiter.js";

// Check IP rate limit
const ip = req.ip || "127.0.0.1";
const status = rateLimiter.check(ip);

if (status.isLimited) {
  return res.status(429).json({
    error: "Too many requests. Please wait.",
    resetMs: status.resetMs,
  });
}
```
