# System Architecture & Component Interaction Specification

WordPot decouples real-time gameplay UI from backend escrow settlement using a hybrid Socket.IO and Web3 architecture.

## Component Overview

```
+------------------+         +--------------------+         +------------------+
|  React Client    | <=====> | Node.js Server     | <=====> | Celo Smart       |
|  (Vite + Tailwind| WebSocket (Express + IO)     |   viem  | Contracts        |
+------------------+         +--------------------+         +------------------+
```

## Resilience Architecture

* **In-Memory Fallback**: If PostgreSQL or Redis connections are absent, the server automatically operates in high-performance in-memory/JSON fallback mode without shutting down.
* **Telemetry**: Live system monitoring via `/api/health`.
* **Zero-Dependency Audio**: Browser-native Web Audio API synthesizer for sound feedback.
