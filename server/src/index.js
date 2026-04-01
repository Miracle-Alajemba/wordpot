import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const ENTRY_FEE = "0.1 cUSD";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const ROUND_SECONDS = 60;
const ROUND_SEEDS = [
  {
    sourceWord: "BLOCKCHAIN",
    validWords: [
      "back","bach","bail","ball","bank","bin","black","block","blot","boat","bolt",
      "chain","chalk","chat","chin","clan","clock","clot","coal","coat","coin","cold",
      "hail","hall","halt","hat","hint","into","kick","lain","land","lack","loan","lock",
      "loin","lot","mail","main","mall","mint","nail","night","path","thin","thank",
      "tonic","tail","tank","talk",
    ],
  },
  {
    sourceWord: "REMITTANCE",
    validWords: [
      "ant","art","care","cart","cat","cement","certain","crate","crane","earn","eastern",
      "enter","mare","meat","mint","name","near","rate","react","remain","rent","rice",
      "scar","steam","stare","team","term","trace","train","treat",
    ],
  },
  {
    sourceWord: "COMMUNITY",
    validWords: [
      "coin","comic","commute","count","county","cut","mint","mono","moon","mount","mouth",
      "unity","unto","tiny","tonic","touch","tour","trim","tunic","unit","omit","icon","city",
    ],
  },
];
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

function buildLetterCounts(word) {
  return word.split("").reduce((counts, letter) => {
    counts[letter] = (counts[letter] || 0) + 1;
    return counts;
  }, {});
}

function canBuildFromSource(candidate, sourceWord) {
  const candidateCounts = buildLetterCounts(candidate.toLowerCase());
  const sourceCounts = buildLetterCounts(sourceWord.toLowerCase());

  return Object.entries(candidateCounts).every(
    ([letter, count]) => (sourceCounts[letter] || 0) >= count,
  );
}

function getWordScore(word) {
  if (word.length >= 6) return 12;
  if (word.length === 5) return 8;
  if (word.length === 4) return 5;
  return 3;
}

function pickRoundSeed() {
  return ROUND_SEEDS[Math.floor(Math.random() * ROUND_SEEDS.length)];
}

function getRoomFeed(room) {
  return room.submissions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => ({
      word: entry.word,
      score: entry.score,
      playerId: entry.playerId,
      walletAddress: entry.walletAddress,
      createdAt: entry.createdAt,
    }));
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

app.post("/api/rooms/:roomId/start", (req, res) => {
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
  const roundSeed = pickRoundSeed();
  room.sourceWord = roundSeed.sourceWord;
  room.validWords = roundSeed.validWords;
  room.submissions = [];

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

  if (!rawWord) {
    return res.status(400).json({ error: "Type a word before claiming it." });
  }

  if (!/^[a-z]+$/.test(rawWord)) {
    return res.status(400).json({ error: "Only letters are allowed." });
  }

  if (rawWord.length < 3) {
    return res.status(400).json({ error: "Words must be at least 3 letters." });
  }

  const alreadyClaimed = room.submissions.some((entry) => entry.word === rawWord);
  if (alreadyClaimed) {
    return res.status(409).json({ error: "Already used by another player." });
  }

  if (!canBuildFromSource(rawWord, room.sourceWord)) {
    return res.status(400).json({ error: "That word cannot be formed from the source word." });
  }

  if (!room.validWords.includes(rawWord)) {
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

  return res.status(201).json({
    submission,
    room: getRoomSummary(room),
  });
});

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});
