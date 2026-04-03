import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { canBuildFromSource, deriveValidWords, getDynamicRound } from "./rounds.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const ENTRY_FEE = "0.1 cUSD";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const ROUND_SECONDS = 60;
const rooms = new Map();

app.use(cors());
app.use(express.json());

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRewardPool(playerCount) {
  return (playerCount * 0.1 * 0.9).toFixed(2);
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function getWordScore(word) {
  if (word.length >= 6) return 12;
  if (word.length === 5) return 8;
  if (word.length === 4) return 5;
  return 3;
}

function getRoomFeed(room) {
  return (room.events || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => ({ ...entry }));
}

function getScoreboard(room) {
  return room.players
    .map((player) => {
      const score = room.submissions
        .filter((entry) => entry.playerId === player.id)
        .reduce((sum, entry) => sum + entry.score, 0);

      return {
        playerId: player.id,
        walletAddress: player.walletAddress,
        score,
        wordsFound: room.submissions.filter((entry) => entry.playerId === player.id).length,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function settleRoom(room) {
  if (room.status !== "active") return;
  if (!room.endsAt) return;
  if (Date.now() < room.endsAt) return;
  room.status = "finished";
}

function getPayouts(room) {
  const scoreboard = getScoreboard(room);
  const rewardPool = Number(getRewardPool(room.players.length));
  const totalScore = scoreboard.reduce((sum, entry) => sum + entry.score, 0);

  if (!totalScore) {
    return scoreboard.map((entry) => ({
      walletAddress: entry.walletAddress,
      amount: 0,
    }));
  }

  return scoreboard.map((entry) => ({
    walletAddress: entry.walletAddress,
    amount: Number(((entry.score / totalScore) * rewardPool).toFixed(4)),
  }));
}

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getRoomSummary(room) {
  settleRoom(room);

  return {
    id: room.id,
    status: room.status,
    entryFee: ENTRY_FEE,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    roundDurationSeconds: ROUND_SECONDS,
    hostPlayerId: room.hostPlayerId,
    sourceWord: room.sourceWord || null,
    rewardPool: `${getRewardPool(room.players.length)} cUSD`,
    createdAt: room.createdAt,
    startedAt: room.startedAt || null,
    endsAt: room.endsAt || null,
    timeLeftSeconds:
      room.status === "active" && room.endsAt
        ? Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000))
        : 0,
    players: room.players.map((player) => ({
      id: player.id,
      walletAddress: player.walletAddress,
      joinedAt: player.joinedAt,
      isHost: player.id === room.hostPlayerId,
    })),
    feed: getRoomFeed(room),
    scoreboard: getScoreboard(room),
    payouts: room.status === "finished" ? getPayouts(room) : [],
  };
}

function getWaitingRoom() {
  return Array.from(rooms.values()).find(
    (room) => room.status === "waiting" && room.players.length < MAX_PLAYERS,
  );
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "wordpot-server",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    name: "WordPot",
    entryFee: ENTRY_FEE,
    roundDurationSeconds: 60,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    minWordLength: 3,
  });
});

app.get("/api/rounds/practice", async (_req, res) => {
  try {
    const round = await getDynamicRound();
    return res.json({ round });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to generate a practice round right now.",
    });
  }
});

app.post("/api/rooms/quick-match", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid wallet address is required." });
  }

  let room = getWaitingRoom();

  if (!room) {
    const hostPlayerId = makeId("player");
    room = {
      id: makeId("room"),
      status: "waiting",
      hostPlayerId,
      createdAt: new Date().toISOString(),
      players: [],
      sourceWord: null,
      startedAt: null,
      endsAt: null,
      validWords: [],
      submissions: [],
      events: [],
    };
    rooms.set(room.id, room);
  }

  const alreadyJoined = room.players.some(
    (player) => player.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (alreadyJoined) {
    return res.status(409).json({ error: "This wallet is already in the room." });
  }

  const player = {
    id: room.players.length === 0 ? room.hostPlayerId : makeId("player"),
    walletAddress,
    joinedAt: new Date().toISOString(),
  };

  room.players.push(player);

  return res.status(201).json({
    room: getRoomSummary(room),
    playerId: player.id,
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);

  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  return res.json({
    room: getRoomSummary(room),
  });
});

app.post("/api/rooms/:roomId/start", async (req, res) => {
  const room = rooms.get(req.params.roomId);
  const playerId = String(req.body?.playerId || "").trim();

  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  if (room.status !== "waiting") {
    return res.status(400).json({ error: "This room has already started." });
  }

  if (room.hostPlayerId !== playerId) {
    return res.status(403).json({ error: "Only the host can start this room." });
  }

  if (room.players.length < MIN_PLAYERS) {
    return res.status(400).json({
      error: `At least ${MIN_PLAYERS} players are needed before the room can start.`,
    });
  }

  room.status = "active";
  room.startedAt = new Date().toISOString();
  room.endsAt = Date.now() + ROUND_SECONDS * 1000;
  const roundSeed = await getDynamicRound();
  room.sourceWord = roundSeed.sourceWord;
  room.validWords = roundSeed.validWords;
  room.submissions = [];
  room.events = [];

  return res.json({
    room: getRoomSummary(room),
  });
});

app.post("/api/rooms/:roomId/submit", (req, res) => {
  const room = rooms.get(req.params.roomId);
  const playerId = String(req.body?.playerId || "").trim();
  const rawWord = normalizeWord(req.body?.word);

  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  settleRoom(room);

  if (room.status !== "active") {
    return res.status(400).json({ error: "This room is not active." });
  }

  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) {
    return res.status(403).json({ error: "Player not found in this room." });
  }

  function logEvent({ status, word, score = 0, reason = "" }) {
    room.events.push({
      playerId,
      walletAddress: player.walletAddress,
      word,
      score,
      status,
      reason,
      createdAt: new Date().toISOString(),
    });
  }

  if (!rawWord) {
    logEvent({ status: "rejected", word: "", reason: "Empty submission" });
    return res.status(400).json({ error: "Type a word before claiming it." });
  }

  if (!/^[a-z]+$/.test(rawWord)) {
    logEvent({ status: "rejected", word: rawWord, reason: "Letters only" });
    return res.status(400).json({ error: "Only letters are allowed." });
  }

  if (rawWord.length < 3) {
    logEvent({ status: "rejected", word: rawWord, reason: "Too short" });
    return res.status(400).json({ error: "Words must be at least 3 letters." });
  }

  const alreadyClaimed = room.submissions.some((entry) => entry.word === rawWord);
  if (alreadyClaimed) {
    logEvent({ status: "rejected", word: rawWord, reason: "Already used" });
    return res.status(409).json({ error: "Already used by another player." });
  }

  if (!canBuildFromSource(rawWord, room.sourceWord)) {
    logEvent({ status: "rejected", word: rawWord, reason: "Outside source word" });
    return res.status(400).json({ error: "That word cannot be formed from the source word." });
  }

  if (!room.validWords.includes(rawWord)) {
    logEvent({ status: "rejected", word: rawWord, reason: "Invalid word" });
    return res.status(400).json({ error: "That word is not valid for this round." });
  }

  const submission = {
    playerId,
    walletAddress: player.walletAddress,
    word: rawWord,
    score: getWordScore(rawWord),
    createdAt: new Date().toISOString(),
  };

  room.submissions.push(submission);
  logEvent({
    status: "accepted",
    word: rawWord,
    score: submission.score,
  });

  return res.status(201).json({
    submission,
    room: getRoomSummary(room),
  });
});

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});
