# Room Lifecycle & Lobby State Machine

Multiplayer rooms transition through strict deterministic state machines to synchronize waiting lobbies, live game rounds, and smart contract settlements.

## State Transition Diagram

```
+---------------+        Host Starts        +---------------+
|     LOBBY     | ------------------------> |    ACTIVE     |
| (4-min limit) |                           | (60-sec round)|
+-------+-------+                           +-------+-------+
        |                                           |
        | Timer Expires                             | Time Up
        v                                           v
+---------------+                           +---------------+
|    EXPIRED    |                           |    SETTLED    |
| (Allow refund)|                           | (Pay winners) |
+---------------+                           +---------------+
```

## State Machine Definitions

### 1. `LOBBY`
* **Duration**: 4-minute maximum window.
* **Actions**: Host shares invite link; players join and stake entry fee.
* **Exit Conditions**: Host triggers start OR 4-minute countdown expires.

### 2. `ACTIVE`
* **Duration**: Exactly 60 seconds.
* **Actions**: Live gameplay; source word displayed; word submissions validated.
* **Exit Conditions**: Round countdown reaches `0`.

### 3. `SETTLED`
* **Actions**: Operator dispatches contract settlement transaction (`settleRoom`). Reward distribution output rendered on UI screen.

### 4. `EXPIRED`
* **Trigger**: 4 minutes elapse without host starting the match.
* **Actions**: Lobby closes; `claimRefund` unlocked on contract.
