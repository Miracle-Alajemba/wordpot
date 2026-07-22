# Matchmaking & Room Invitation Specifications

WordPot supports both direct player-to-player private room links and open public lobby matchmaking queues.

## Invitation & Link Format

When a host creates a new room, a unique 8-character hex room ID is generated (`room_8f91a2`).

### Invite URL Structure
```
https://wordpot.vercel.app/?room=room_8f91a2
```
* **Auto-Lobby Join**: When a user opens an invite URL, the client extracts `room` from URL search parameters (`window.location.search`) and immediately loads the corresponding lobby state.

---

## Matchmaking Modes

### 1. Private Invite Mode
* Room is accessible only to players who possess the direct URL or room code.
* Host can configure maximum player capacity (2 to 8 players).

### 2. Public Lobby Queue
* Rooms flagged as `isPublic: true` appear on the **Open Lobbies** list on the home screen.
* Any connected wallet can tap **Join Lobby** to stake entry fees and enter the waiting room.
