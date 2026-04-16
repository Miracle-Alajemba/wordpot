import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { canBuildFromSource, getDynamicRound } from "./rounds.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const ENTRY_FEE = "0.1 cUSD";
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const ROUND_SECONDS = 60;
const TREASURY_WALLET = process.env.TREASURY_WALLET || "0x0000000000000000000000000000000000000000";
const WORDPOT_CONTRACT_ADDRESS =
  process.env.WORDPOT_CONTRACT_ADDRESS || process.env.LEXMASH_CONTRACT_ADDRESS || "";
const CELO_CHAIN_ID = Number(process.env.CELO_CHAIN_ID || 42220);
const JOIN_PAYMENT_WEI = process.env.JOIN_PAYMENT_WEI || "1000000000000000";
const JOIN_PAYMENT_DISPLAY = process.env.JOIN_PAYMENT_DISPLAY || "0.001 CELO";
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

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

function isTxHash(value) {
  return /^0x([A-Fa-f0-9]{64})$/.test(String(value || "").trim());
}

function getRoomFeed(room) {
  return (room.events || [])
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
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

function getPaidPlayerIds(room) {
  return new Set((room.joinTransactions || []).map((entry) => entry.playerId));
}

function hasPlayerPaid(room, playerId) {
  return getPaidPlayerIds(room).has(playerId);
}

function hasPlayerClaimRecord(room, playerId) {
  return (room.claimTransactions || []).some((entry) => entry.playerId === playerId);
}

function settleRoom(room) {
  if (room.status !== "active") return;
  if (!room.endsAt) return;
  if (Date.now() < room.endsAt) return;
  room.status = "finished";
  room.events.push({
    type: "system",
    status: "system",
    message: "Game over! Results are ready.",
    createdAt: new Date().toISOString(),
  });
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

function pushSystemEvent(room, message) {
  room.events.push({
    type: "system",
    status: "system",
    message,
    createdAt: new Date().toISOString(),
  });
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
      joinPaid: hasPlayerPaid(room, player.id),
      claimRecorded: hasPlayerClaimRecord(room, player.id),
    })),
    feed: getRoomFeed(room),
    scoreboard: getScoreboard(room),
    payouts: room.status === "finished" ? getPayouts(room) : [],
    onchain: {
      chainId: CELO_CHAIN_ID,
      treasuryWallet: TREASURY_WALLET,
      contractAddress: WORDPOT_CONTRACT_ADDRESS,
      joinPaymentWei: JOIN_PAYMENT_WEI,
      joinPaymentDisplay: JOIN_PAYMENT_DISPLAY,
      payoutMode: isWalletAddress(WORDPOT_CONTRACT_ADDRESS) ? "contract_claim" : "treasury_beta",
      joinTransactions: room.joinTransactions || [],
      claimTransactions: room.claimTransactions || [],
      paidPlayersCount: getPaidPlayerIds(room).size,
    },
  };
}

function getWaitingRoom() {
  return Array.from(rooms.values()).find(
    (room) => room.status === "waiting" && room.players.length < MAX_PLAYERS,
  );
}

function getCommunityLeaderboard() {
  const aggregate = new Map();

  for (const room of rooms.values()) {
    settleRoom(room);
    const scoreboard = getScoreboard(room);

    for (const entry of scoreboard) {
      const current = aggregate.get(entry.walletAddress) || {
        walletAddress: entry.walletAddress,
        score: 0,
        wordsFound: 0,
        gamesPlayed: 0,
        wins: 0,
      };

      current.score += entry.score;
      current.wordsFound += entry.wordsFound;
      current.gamesPlayed += 1;

      if (scoreboard[0]?.walletAddress === entry.walletAddress && entry.score > 0) {
        current.wins += 1;
      }

      aggregate.set(entry.walletAddress, current);
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.wordsFound - a.wordsFound;
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
}

function getRoomOr404(roomId, res) {
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return null;
  }
  return room;
}

function getValidatedPlayerOrError(room, playerId, walletAddress, res) {
  const normalizedWallet = String(walletAddress || "").trim();

  if (!playerId) {
    res.status(400).json({ error: "Player id is required." });
    return null;
  }

  if (!isWalletAddress(normalizedWallet)) {
    res.status(400).json({ error: "A valid wallet address is required." });
    return null;
  }

  const player = room.players.find((entry) => entry.id === playerId);

  if (!player) {
    res.status(403).json({ error: "Player not found in this room." });
    return null;
  }

  if (player.walletAddress.toLowerCase() !== normalizedWallet.toLowerCase()) {
    res.status(403).json({ error: "Wallet does not match this room player." });
    return null;
  }

  return player;
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
    onchain: {
      chainId: CELO_CHAIN_ID,
      treasuryWallet: TREASURY_WALLET,
      contractAddress: WORDPOT_CONTRACT_ADDRESS,
      joinPaymentWei: JOIN_PAYMENT_WEI,
      joinPaymentDisplay: JOIN_PAYMENT_DISPLAY,
      payoutMode: isWalletAddress(WORDPOT_CONTRACT_ADDRESS) ? "contract_claim" : "treasury_beta",
    },
  });
});

app.get("/api/leaderboard", (_req, res) => {
  res.json({
    entries: getCommunityLeaderboard(),
    updatedAt: new Date().toISOString(),
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
      joinTransactions: [],
      claimTransactions: [],
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
  pushSystemEvent(room, `${player.walletAddress} joined the game`);

  return res.status(201).json({
    room: getRoomSummary(room),
    playerId: player.id,
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  return res.json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/start", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  if (!room) return;

  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (room.status !== "waiting") {
    return res.status(400).json({ error: "This room has already started." });
  }

  if (room.hostPlayerId !== player.id) {
    return res.status(403).json({ error: "Only the host can start this room." });
  }

  if (room.players.length < MIN_PLAYERS) {
    return res.status(400).json({
      error: `At least ${MIN_PLAYERS} players are needed before the room can start.`,
    });
  }

  const unpaidPlayers = room.players.filter((entry) => !hasPlayerPaid(room, entry.id));
  if (unpaidPlayers.length) {
    return res.status(400).json({
      error: `All players must complete the onchain join payment before the room starts. ${unpaidPlayers.length} unpaid.`,
    });
  }

  const roundSeed = await getDynamicRound();
  room.status = "active";
  room.startedAt = new Date().toISOString();
  room.endsAt = Date.now() + ROUND_SECONDS * 1000;
  room.sourceWord = roundSeed.sourceWord;
  room.validWords = roundSeed.validWords;
  room.submissions = [];
  room.events = [];
  pushSystemEvent(room, "Game starting now");

  return res.json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/submit", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const rawWord = normalizeWord(req.body?.word);
  if (!room) return;

  settleRoom(room);

  if (room.status !== "active") {
    return res.status(400).json({ error: "This room is not active." });
  }

  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  function logEvent({ status, word, score = 0, reason = "" }) {
    room.events.push({
      type: "submission",
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
  logEvent({ status: "accepted", word: rawWord, score: submission.score });

  return res.status(201).json({
    submission,
    room: getRoomSummary(room),
  });
});

app.post("/api/rooms/:roomId/join-tx", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();
  const amount = String(req.body?.amount || JOIN_PAYMENT_DISPLAY).trim();
  const mode = String(req.body?.mode || "treasury_beta").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (!isTxHash(txHash)) {
    return res.status(400).json({ error: "A valid transaction hash is required." });
  }

  const duplicate = room.joinTransactions.some((entry) => entry.txHash.toLowerCase() === txHash.toLowerCase());
  if (!duplicate) {
    room.joinTransactions.push({
      playerId,
      walletAddress: player.walletAddress,
      txHash,
      amount,
      mode,
      createdAt: new Date().toISOString(),
    });
    pushSystemEvent(room, `${shortenAddress(player.walletAddress)} funded the room onchain`);
  }

  return res.status(201).json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/claim-tx", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();
  const amount = String(req.body?.amount || "0").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {
    return res.status(400).json({ error: "Rewards can only be claimed after the room ends." });
  }

  if (!isTxHash(txHash)) {
    return res.status(400).json({ error: "A valid transaction hash is required." });
  }

  const duplicate = room.claimTransactions.some((entry) => entry.txHash.toLowerCase() === txHash.toLowerCase());
  if (!duplicate) {
    room.claimTransactions.push({
      playerId,
      walletAddress: player.walletAddress,
      txHash,
      amount,
      createdAt: new Date().toISOString(),
    });
    pushSystemEvent(room, `${shortenAddress(player.walletAddress)} claimed a reward onchain`);
  }

  return res.status(201).json({ room: getRoomSummary(room) });
});

function shortenAddress(value) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});
