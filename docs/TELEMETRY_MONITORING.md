# Server System Telemetry & Monitoring Specification

The WordPot server provides real-time operational telemetry via the `/api/health` HTTP endpoint.

## Endpoint Schema

`GET /api/health`

### Response Payload Structure

```json
{
  "status": "ok",
  "service": "wordpot-server",
  "timestamp": "2026-07-26T02:00:00.000Z",
  "uptimeSeconds": 3600,
  "uptimeFormatted": "1h 0m 0s",
  "memory": {
    "heapUsedMb": 42.15,
    "heapTotalMb": 85.30,
    "rssMb": 110.45
  },
  "rooms": {
    "totalRooms": 12,
    "activeRooms": 3,
    "waitingRooms": 5,
    "finishedRooms": 4
  },
  "activePlayers": 18,
  "services": {
    "database": "fallback_mode",
    "redis": "connected"
  }
}
```

## Metrics Definitions

* `uptimeSeconds`: Total elapsed process uptime in seconds.
* `uptimeFormatted`: Human-readable formatted string duration (`1d 2h 3m 4s`).
* `memory.heapUsedMb`: Active V8 heap memory consumed by Node.js objects.
* `rooms`: Breakdown of currently managed game rooms by lifecycle status (`waiting`, `active`, `finished`).
* `activePlayers`: Count of distinct active wallet addresses connected across all live game rooms.
* `services.database`: Database connection state (`connected` or `fallback_mode`).
* `services.redis`: Redis adapter connection state (`connected` or `in_memory`).
