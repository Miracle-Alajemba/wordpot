# Server & Blockchain Health Monitoring Specifications

WordPot includes automated health check endpoints for deployment platform monitoring (e.g. Render, Railway, Vercel) and Celo RPC node connectivity verification.

## Endpoint: `GET /api/health`

### Request Header
`Accept: application/json`

### Success Response (`200 OK`)
```json
{
  "status": "healthy",
  "timestamp": "2026-07-22T23:45:00.000Z",
  "uptimeSeconds": 86400,
  "services": {
    "dictionaryLoaded": true,
    "dictionaryWordCount": 105432,
    "celoRpcConnected": true,
    "latestBlockNumber": 26491023,
    "activeRoomsCount": 4
  }
}
```

### Degraded Response (`503 Service Unavailable`)
```json
{
  "status": "degraded",
  "reason": "Celo RPC node timeout or operator wallet insufficient balance"
}
```

## Monitoring Metrics

1. **Active Rooms Gauge**: Number of lobbies currently in `LOBBY` or `ACTIVE` state.
2. **Dictionary Health**: Verification that `english-words.txt` is held in server memory.
3. **Operator Gas Reserve**: Alert triggered if operator key CELO balance drops below 0.5 CELO.
