# WordPot Backend REST API Specifications

The WordPot server is built with Node.js and Express, acting as the authoritative engine for room orchestration, word validation, timer enforcement, and daily reward eligibility checks.

## Base URL
- Production: `https://wordpot-server.onrender.com` (or relative path in deployment)
- Local Development: `http://localhost:3001`

---

## Endpoints

### 1. Create Room
Creates a new game room with an initial source word and waiting lobby.

* **URL**: `/api/rooms`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "hostAddress": "0x1234...5678",
    "entryFee": "0.1",
    "maxPlayers": 4
  }
  ```
* **Success Response** (`201 Created`):
  ```json
  {
    "success": true,
    "roomId": "room_8f91a2",
    "inviteLink": "https://wordpot.vercel.app?room=room_8f91a2",
    "sourceWord": "SPLENDID",
    "status": "LOBBY",
    "expiresAt": 1784768400
  }
  ```

---

### 2. Get Room State
Fetches real-time details, player lists, scores, and status for a given room.

* **URL**: `/api/rooms/:roomId`
* **Method**: `GET`
* **Response** (`200 OK`):
  ```json
  {
    "roomId": "room_8f91a2",
    "status": "ACTIVE",
    "sourceWord": "SPLENDID",
    "players": [
      { "address": "0x1234...5678", "score": 24, "paid": true, "isHost": true },
      { "address": "0x8765...4321", "score": 18, "paid": true, "isHost": false }
    ],
    "remainingSeconds": 145
  }
  ```

---

### 3. Join Room
Registers a player's wallet address into a lobby and records payment confirmation.

* **URL**: `/api/rooms/:roomId/join`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "playerAddress": "0x8765...4321",
    "txHash": "0xabc123..."
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "roomId": "room_8f91a2",
    "playerCount": 2
  }
  ```

---

### 4. Submit Word
Validates and scores a word submitted by a player during an active round.

* **URL**: `/api/rooms/:roomId/submit`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "playerAddress": "0x8765...4321",
    "word": "LEND"
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "valid": true,
    "word": "LEND",
    "points": 5,
    "totalScore": 23
  }
  ```
* **Error Response** (`400 Bad Request`):
  ```json
  {
    "valid": false,
    "reason": "Word not in source letter pool or already submitted"
  }
  ```

---

### 5. Daily Challenge Payout Claim
Verifies minimum score achievement and authorizes an automated CELO payout from the daily reward contract.

* **URL**: `/api/daily/claim`
* **Method**: `POST`
* **Request Body**:
  ```json
  {
    "walletAddress": "0x1234...5678",
    "score": 45
  }
  ```
* **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "txHash": "0xd4e5f6...",
    "reward": "0.01 CELO"
  }
  ```
