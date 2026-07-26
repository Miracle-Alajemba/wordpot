# Client Event Bus Specification

WordPot incorporates a zero-dependency publish-subscribe event emitter (`EventEmitter`) in `client/src/utils/event-emitter.js` for decoupled component communication.

## Usage Example

```javascript
import { eventBus } from "../utils/event-emitter.js";

// Subscribe to event
const unsubscribe = eventBus.on("room_joined", (player) => {
  console.log("Player joined:", player.walletAddress);
});

// Emit event
eventBus.emit("room_joined", { walletAddress: "0x1234...abcd" });

// Clean up listener
unsubscribe();
```

## Standard Event Names

* `room_joined`: Emitted when player successfully enters game room.
* `word_submitted`: Emitted on word submission attempt.
* `score_updated`: Emitted when room scores update.
* `sound_toggled`: Emitted when user toggles mute state.
