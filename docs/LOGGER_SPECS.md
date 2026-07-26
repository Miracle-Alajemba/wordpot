# Structured Logger Technical Specification

WordPot server incorporates a zero-dependency JSON logger (`logger`) producing machine-readable log streams compatible with Railway, Datadog, and CloudWatch log aggregators.

## Output Format

Logs are formatted as single-line JSON objects:

```json
{
  "timestamp": "2026-07-26T02:00:00.000Z",
  "level": "INFO",
  "message": "Player joined room",
  "roomId": "room_xyz",
  "walletAddress": "0x1234...abcd"
}
```

## Log Levels

1. `debug`: Detailed diagnostic output (suppressed in production by default).
2. `info`: Standard operational milestones.
3. `warn`: Recoverable failures or fallback activations.
4. `error`: Critical system exceptions and contract errors.
