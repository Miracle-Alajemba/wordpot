# Backend REST API Routes Specification

WordPot backend provides Express HTTP REST endpoints for room matchmaking, daily challenges, user profiles, and leaderboards.

## Core Endpoints

* `GET /api/health`: System health telemetry JSON object.
* `GET /api/leaderboard`: Seasonal leaderboard player rankings.
* `POST /api/rooms/create`: Initialize new game room.
* `POST /api/rooms/:roomId/join`: Enter existing waiting room lobby.
* `POST /api/rooms/:roomId/submit`: Claim valid word submission.
* `POST /api/rooms/:roomId/start`: Host trigger to start game round.
* `POST /api/rooms/:roomId/settle`: Settle room final scores.
* `POST /api/users/profile`: Fetch or update player custom handle.
