import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import zlib from "zlib";
import { recoverMessageAddress } from "viem";
import { canBuildFromSource, getDynamicRound } from "./rounds.js";
import { createWordPotContractService } from "./wordpot-contract.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const ROUND_SECONDS = 60;
const TREASURY_WALLET =
  process.env.TREASURY_WALLET || "0x0000000000000000000000000000000000000000";
const WORDPOT_CONTRACT_ADDRESS =
  process.env.WORDPOT_CONTRACT_ADDRESS ||
  process.env.LEXMASH_CONTRACT_ADDRESS ||
  "";
const CONTRACT_OPERATOR_PRIVATE_KEY =
  process.env.CONTRACT_OPERATOR_PRIVATE_KEY || "";
const CELO_MAINNET_RPC_URL =
  process.env.CELO_MAINNET_RPC_URL || "https://forno.celo.org";
const CELO_CHAIN_ID = Number(process.env.CELO_CHAIN_ID || 42220);
const JOIN_PAYMENT_WEI = process.env.JOIN_PAYMENT_WEI || "1000000000000000";
const JOIN_PAYMENT_DISPLAY = process.env.JOIN_PAYMENT_DISPLAY || "0.001 CELO";
const ENTRY_FEE = JOIN_PAYMENT_DISPLAY;
const REQUIRE_ONCHAIN_ROOM = process.env.REQUIRE_ONCHAIN_ROOM !== "false";
const DEFAULT_FEED_LIMIT = 24;
const DEFAULT_TX_LIMIT = 16;
const DEFAULT_LEADERBOARD_LIMIT = 50;
const DAILY_CLAIMS_FILE =
  process.env.DAILY_CLAIMS_FILE ||
  new URL("../daily-claims.json", import.meta.url);
const RECENT_DAILY_SOURCES_FILE =
  process.env.RECENT_DAILY_SOURCES_FILE ||
  new URL("../recent-daily-sources.json", import.meta.url);
const DAILY_PLAYS_FILE =
  process.env.DAILY_PLAYS_FILE ||
  new URL("../daily-plays.json", import.meta.url);
const LEADERBOARD_SEASONS_FILE =
  process.env.LEADERBOARD_SEASONS_FILE ||
  new URL("../leaderboard-seasons.json", import.meta.url);
const DAILY_RESET_HOUR = Math.max(
  0,
  Math.min(23, Number(process.env.DAILY_RESET_HOUR || 0)),
);
const rooms = new Map();
const dailyClaims = loadDailyClaims(); // key: "walletAddress:YYYY-MM-DD" -> claim entry
const dailyPlays = loadDailyPlays(); // key: "walletAddress:YYYY-MM-DD" -> play entry
const leaderboardSeasons = loadLeaderboardSeasons();
const dailyChallengeSessions = new Map();
let recentDailySourceWords = loadRecentDailySources();
const recentUsedSourceWords = []; // rolling history of last 20 words used across rooms/practice
const roomJoinLocks = new Map(); // roomId -> Set<walletAddress_lowercase> for concurrent join protection
let roomStateVersion = 0;
let leaderboardCache = null;

const wordPotContract = createWordPotContractService({
  contractAddress: WORDPOT_CONTRACT_ADDRESS,
  operatorPrivateKey: CONTRACT_OPERATOR_PRIVATE_KEY,
  rpcUrl: CELO_MAINNET_RPC_URL,
  chainId: CELO_CHAIN_ID,
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

function isAdminRequest(req) {
  if (!ADMIN_TOKEN) return false;
  const token = String(req.headers["x-admin-token"] || "").trim();
  return token && token === ADMIN_TOKEN;
}

// ─── Room expiry — runs every 30 seconds ──────────────────────────────────────
setInterval(() => {
  const EXPIRY_MS = 4 * 60 * 1000;
  for (const [roomId, room] of rooms.entries()) {
    if (room.status !== "waiting") continue;
    const age = Date.now() - new Date(room.createdAt).getTime();
    if (age > EXPIRY_MS) {
      room.status = "expired";
      pushSystemEvent(room, "Room expired. No game started in time.");
      markRoomDirty(room);
    }
  }
}, 30_000);

app.use(cors());
app.use(rateLimiter);
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  if (!/\bgzip\b/.test(acceptEncoding)) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body) < 1024) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(body);
    }

    zlib.gzip(body, (error, compressed) => {
      if (error) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.send(body);
        return;
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.send(compressed);
    });
  };

  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 120;
const SENSITIVE_RATE_LIMIT_MAX = 20;

function getRateLimitBucket(req) {
  if (req.path.startsWith("/api/daily")) return "daily";
  if (req.method !== "GET" && req.path.startsWith("/api/rooms")) return "rooms";
  return "default";
}

function rateLimiter(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  const bucket = getRateLimitBucket(req);
  const maxRequests =
    bucket === "default" ? DEFAULT_RATE_LIMIT_MAX : SENSITIVE_RATE_LIMIT_MAX;
  const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${bucket}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(key) || []).filter(
    (entry) => entry > windowStart,
  );

  timestamps.push(now);
  rateLimitMap.set(key, timestamps);

  if (timestamps.length > maxRequests) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please slow down and try again." });
  }

  next();
}

function loadDailyClaims() {
  try {
    if (!fs.existsSync(DAILY_CLAIMS_FILE)) {
      return new Map();
    }

    const raw = fs.readFileSync(DAILY_CLAIMS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed || {}));
  } catch (error) {
    console.warn(`Unable to load daily claims: ${error.message}`);
    return new Map();
  }
}

function loadLeaderboardSeasons() {
  try {
    if (!fs.existsSync(LEADERBOARD_SEASONS_FILE)) {
      return { activeSeason: 1, seasonEndsAt: "2026-06-12T00:00:00Z", players: {} };
    }
    const raw = fs.readFileSync(LEADERBOARD_SEASONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    parsed.players = parsed.players || {};
    return parsed;
  } catch (error) {
    console.warn(`Unable to load leaderboard seasons: ${error.message}`);
    return { activeSeason: 1, seasonEndsAt: "2026-06-12T00:00:00Z", players: {} };
  }
}

function persistLeaderboardSeasons() {
  try {
    fs.writeFileSync(
      LEADERBOARD_SEASONS_FILE,
      JSON.stringify(leaderboardSeasons, null, 2),
    );
  } catch (error) {
    console.error(`Unable to persist leaderboard seasons: ${error.message}`);
  }
}

function getSeasonalLeaderboard() {
  const entries = Object.values(leaderboardSeasons.players)
    .filter((player) => player.registered === true)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.wordsFound - a.wordsFound;
    })
    .slice(0, DEFAULT_LEADERBOARD_LIMIT)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
  return entries;
}

function updateSeasonalStatsForRoom(room) {
  try {
    const derived = getRoomDerived(room);
    const scoreboard = derived.scoreboard;
    if (!scoreboard || !scoreboard.length) return;

    const winnerAddress = scoreboard[0]?.score > 0 ? scoreboard[0]?.walletAddress.toLowerCase() : null;

    for (const entry of scoreboard) {
      const addressLower = entry.walletAddress.toLowerCase();
      
      // Initialize player in database if not exist
      if (!leaderboardSeasons.players[addressLower]) {
        leaderboardSeasons.players[addressLower] = {
          walletAddress: entry.walletAddress,
          registered: false,
          score: 0,
          wordsFound: 0,
          gamesPlayed: 0,
          wins: 0,
          boosterGamesRemaining: 0,
        };
      }

      const playerRecord = leaderboardSeasons.players[addressLower];
      
      // Check if player has an active booster
      let multiplier = 1;
      if (playerRecord.boosterGamesRemaining > 0) {
        multiplier = 2;
        playerRecord.boosterGamesRemaining -= 1;
        console.info(`[leaderboard] Applied 2x booster for ${entry.walletAddress}. Boosters remaining: ${playerRecord.boosterGamesRemaining}`);
      }

      // Add to stats
      playerRecord.score += (entry.score * multiplier);
      playerRecord.wordsFound += entry.wordsFound;
      playerRecord.gamesPlayed += 1;
      if (winnerAddress === addressLower) {
        playerRecord.wins += 1;
      }
    }

    persistLeaderboardSeasons();
    console.info(`[leaderboard] Seasonal stats updated for room ${room.id}`);
  } catch (error) {
    console.error(`[leaderboard] Failed to update seasonal stats: ${error.message}`);
  }
}

function loadRecentDailySources() {
  try {
    if (!fs.existsSync(RECENT_DAILY_SOURCES_FILE)) return [];
    const raw = fs.readFileSync(RECENT_DAILY_SOURCES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) =>
        String(s || "")
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean);
  } catch (error) {
    console.warn(`Unable to load recent daily sources: ${error.message}`);
    return [];
  }
}

function persistRecentDailySources() {
  try {
    fs.writeFileSync(
      RECENT_DAILY_SOURCES_FILE,
      JSON.stringify(recentDailySourceWords.slice(-100), null, 2),
    );
  } catch (error) {
    console.error(`Unable to persist recent daily sources: ${error.message}`);
  }
}

function loadDailyPlays() {
  try {
    if (!fs.existsSync(DAILY_PLAYS_FILE)) return new Map();
    const raw = fs.readFileSync(DAILY_PLAYS_FILE, "utf8");
    const parsed = JSON.parse(raw) || {};

    // Support migration from old key format wallet:YYYY-MM-DD -> value
    const out = new Map();
    for (const [key, value] of Object.entries(parsed)) {
      if (String(key).includes(":")) {
        const wallet = String(key).split(":")[0].toLowerCase();
        const playedAt = value?.playedAt || new Date().toISOString();
        out.set(wallet, { playedAt });
      } else {
        const wallet = String(key).toLowerCase();
        if (value && typeof value === "object" && value.playedAt) {
          out.set(wallet, { playedAt: value.playedAt });
        } else if (typeof value === "string" && value) {
          out.set(wallet, { playedAt: value });
        }
      }
    }

    return out;
  } catch (error) {
    console.warn(`Unable to load daily plays: ${error.message}`);
    return new Map();
  }
}

function persistDailyPlays() {
  try {
    fs.writeFileSync(
      DAILY_PLAYS_FILE,
      JSON.stringify(Object.fromEntries(dailyPlays), null, 2),
    );
  } catch (error) {
    console.error(`Unable to persist daily plays: ${error.message}`);
  }
}

function getDayKeyFromTimestamp(ts = Date.now()) {
  const offsetMs = Number(DAILY_RESET_HOUR || 0) * 60 * 60 * 1000;
  const adjusted = new Date(ts - offsetMs);
  return adjusted.toISOString().slice(0, 10);
}

function getNextResetTime(ts = Date.now()) {
  const now = new Date(ts);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  // Candidate reset for current UTC day at reset hour
  const candidate = new Date(
    Date.UTC(year, month, day, DAILY_RESET_HOUR, 0, 0),
  );
  if (candidate.getTime() <= now.getTime()) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  return candidate.toISOString();
}

function persistDailyClaims() {
  try {
    fs.writeFileSync(
      DAILY_CLAIMS_FILE,
      JSON.stringify(Object.fromEntries(dailyClaims), null, 2),
    );
  } catch (error) {
    console.error(`Unable to persist daily claims: ${error.message}`);
  }
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().split("-")[0]}`;
}

function getRewardPool(playerCount) {
  return (
    playerCount *
    (Number(JOIN_PAYMENT_WEI) / 1_000_000_000_000_000_000) *
    0.9
  ).toFixed(4);
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
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

function rememberDailySourceWord(sourceWord) {
  const normalized = String(sourceWord || "")
    .trim()
    .toUpperCase();
  if (!normalized) return;

  recentDailySourceWords.push(normalized);
  while (recentDailySourceWords.length > 100) {
    recentDailySourceWords.shift();
  }
  try {
    persistRecentDailySources();
  } catch (err) {
    // ignore
  }
}

async function getDailyChallengeRound(difficulty = "medium") {
  const roundDiff = difficulty === "hard" ? "hard" : difficulty === "medium" ? "medium" : "easy";
  try {
    // Use rounds.pickNonRecentRound to avoid selecting recently used source words
    const round = await import("./rounds.js").then((m) =>
      m.pickNonRecentRound(roundDiff, recentDailySourceWords),
    );
    if (round && round.sourceWord) {
      rememberDailySourceWord(round.sourceWord);
      console.info(
        `[daily-challenge] selected new source word: ${round.sourceWord} (difficulty=${roundDiff})`,
      );
      return round;
    }
  } catch (error) {
    console.warn(
      `[daily-challenge] pickNonRecentRound failed: ${error.message}`,
    );
  }

  // Fallback: try up to 10 attempts with getDynamicRound (existing behavior)
  let fallbackRound = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const round = await getDynamicRound(roundDiff);
    fallbackRound ||= round;
    if (!recentDailySourceWords.includes(round.sourceWord)) {
      rememberDailySourceWord(round.sourceWord);
      console.info(
        `[daily-challenge] fallback selected new source word: ${round.sourceWord} (attempt ${attempt + 1})`,
      );
      return round;
    }
    console.info(
      `[daily-challenge] fallback skipped recent source word: ${round.sourceWord} (attempt ${attempt + 1})`,
    );
  }

  if (fallbackRound) {
    rememberDailySourceWord(fallbackRound.sourceWord);
    console.warn(
      `[daily-challenge] fallback using round: ${fallbackRound.sourceWord}`,
    );
    return fallbackRound;
  }

  return getDynamicRound(roundDiff);
}

function getTodayKey(walletAddress) {
  const today = getDayKeyFromTimestamp();
  return `${walletAddress.toLowerCase()}:${today}`;
}

function getTodayPlayKey(walletAddress) {
  const today = getDayKeyFromTimestamp();
  return `${walletAddress.toLowerCase()}:${today}`;
}

function isTxHash(value) {
  return /^0x([A-Fa-f0-9]{64})$/.test(String(value || "").trim());
}

function shortenAddress(value) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getCeloExplorerTxUrl(hash) {
  const txHash = String(hash || "").trim();
  if (!txHash) return "";
  return CELO_CHAIN_ID === 44787
    ? `https://alfajores.celoscan.io/tx/${txHash}`
    : `https://celoscan.io/tx/${txHash}`;
}

function normalizeRefundErrorMessage(message) {
  const raw = String(message || "");
  const lower = raw.toLowerCase();
  if (lower.includes("insufficient funds"))
    return "Not enough funds in contract";
  if (lower.includes("already cancelled")) return "You already received refund";
  if (lower.includes("already settled"))
    return "Room is already settled and cannot be refunded";
  if (lower.includes("room missing")) return "Room no longer exists";
  return raw || "Onchain refund failed. Please retry.";
}

function getRoomFeed(room, limit = DEFAULT_FEED_LIMIT) {
  const normalizedLimit = Math.max(1, Number(limit) || DEFAULT_FEED_LIMIT);
  return (room.events || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(-normalizedLimit)
    .map((entry) => ({ ...entry }));
}

function markRoomDirty(room) {
  room._version = (room._version || 0) + 1;
  room._summaryCache = null;
  room._derivedCache = null;
  roomStateVersion += 1;
  leaderboardCache = null;
}

function getPaidPlayerIds(room) {
  return getRoomDerived(room).paidPlayerIds;
}

function hasPlayerPaid(room, playerId) {
  return getPaidPlayerIds(room).has(playerId);
}

function pushSystemEvent(room, message) {
  room.events.push({
    type: "system",
    status: "system",
    message,
    createdAt: new Date().toISOString(),
  });
  markRoomDirty(room);
}

function getRoomDerived(room) {
  if (room._derivedCache?.version === room._version) {
    return room._derivedCache.value;
  }

  const playerStats = new Map(
    room.players.map((player) => [
      player.id,
      {
        playerId: player.id,
        walletAddress: player.walletAddress,
        score: 0,
        wordsFound: 0,
      },
    ]),
  );

  for (const submission of room.submissions || []) {
    const entry = playerStats.get(submission.playerId);
    if (!entry) continue;
    entry.score += submission.score;
    entry.wordsFound += 1;
  }

  const scoreboard = Array.from(playerStats.values()).sort(
    (a, b) => b.score - a.score,
  );
  const rewardPool = Number(getRewardPool(room.players.length));
  const totalScore = scoreboard.reduce((sum, entry) => sum + entry.score, 0);
  const payouts = totalScore
    ? scoreboard.map((entry) => ({
        walletAddress: entry.walletAddress,
        amount: Number(((entry.score / totalScore) * rewardPool).toFixed(4)),
      }))
    : scoreboard.map((entry) => ({
        walletAddress: entry.walletAddress,
        amount: 0,
      }));

  const value = {
    scoreboard,
    payouts,
    paidPlayerIds: new Set(
      (room.joinTransactions || []).map((entry) => entry.playerId),
    ),
    claimPlayerIds: new Set(
      (room.claimTransactions || []).map((entry) => entry.playerId),
    ),
  };

  room._derivedCache = { version: room._version, value };
  return value;
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
  updateSeasonalStatsForRoom(room);
  markRoomDirty(room);
}

function getRoomSummary(room, options = {}) {
  settleRoom(room);
  const feedLimit = Math.max(
    1,
    Number(options.feedLimit) || DEFAULT_FEED_LIMIT,
  );
  const txLimit = Math.max(1, Number(options.txLimit) || DEFAULT_TX_LIMIT);
  const summaryCacheKey = `${room._version || 0}:${feedLimit}:${txLimit}`;
  if (room._summaryCache?.key === summaryCacheKey)
    return room._summaryCache.value;

  const derived = getRoomDerived(room);

  const summary = {
    id: room.id,
    status: room.status,
    entryFee: ENTRY_FEE,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    roundDurationSeconds: ROUND_SECONDS,
    hostPlayerId: room.hostPlayerId,
    sourceWord: room.sourceWord || null,
    rewardPool: `${getRewardPool(room.players.length)} CELO`,
    createdAt: room.createdAt,
    expiresAt:
      room.status === "waiting" && room.createdAt
        ? new Date(
            new Date(room.createdAt).getTime() + 4 * 60 * 1000,
          ).toISOString()
        : null,
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
      joinPaid: derived.paidPlayerIds.has(player.id),
      claimRecorded: derived.claimPlayerIds.has(player.id),
    })),
    feed: getRoomFeed(room, feedLimit),
    scoreboard: derived.scoreboard,
    payouts: room.status === "finished" ? derived.payouts : [],
    onchain: {
      chainId: CELO_CHAIN_ID,
      treasuryWallet: TREASURY_WALLET,
      contractAddress: WORDPOT_CONTRACT_ADDRESS,
      contractRoomId: room.contractRoomId || null,
      contractRoomCreateTx: room.contractRoomCreateTx || null,
      contractSettleTx: room.contractSettleTx || null,
      contractSettledAt: room.contractSettledAt || null,
      contractSettleError: room.contractSettleError || null,
      contractCancelTx: room.contractCancelTx || null,
      contractCancelError: room.contractCancelError || null,
      contractReady: wordPotContract.enabled,
      contractOperatorAddress: wordPotContract.enabled
        ? wordPotContract.account
        : null,
      joinPaymentWei: JOIN_PAYMENT_WEI,
      joinPaymentDisplay: JOIN_PAYMENT_DISPLAY,
      joinMode:
        isWalletAddress(WORDPOT_CONTRACT_ADDRESS) &&
        wordPotContract.enabled &&
        room.contractRoomId
          ? "contract_join"
          : "contract_unavailable",
      payoutMode:
        isWalletAddress(WORDPOT_CONTRACT_ADDRESS) &&
        wordPotContract.enabled &&
        room.contractRoomId
          ? "contract_claim"
          : "contract_unavailable",
      joinTransactions: (room.joinTransactions || []).slice(-txLimit),
      claimTransactions: (room.claimTransactions || []).slice(-txLimit),
      refundTransactions: (room.refundTransactions || []).slice(-txLimit),
      paidPlayersCount: derived.paidPlayerIds.size,
    },
    cancelledAt: room.cancelledAt || null,
  };

  room._summaryCache = { key: summaryCacheKey, value: summary };
  return summary;
}

function getWaitingRoom() {
  return Array.from(rooms.values()).find(
    (room) => room.status === "waiting" && room.players.length < MAX_PLAYERS,
  );
}

function getCommunityLeaderboard() {
  if (leaderboardCache?.version === roomStateVersion)
    return leaderboardCache.entries;

  const aggregate = new Map();

  for (const room of rooms.values()) {
    settleRoom(room);
    const scoreboard = getRoomDerived(room).scoreboard;
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
      if (
        scoreboard[0]?.walletAddress === entry.walletAddress &&
        entry.score > 0
      ) {
        current.wins += 1;
      }
      aggregate.set(entry.walletAddress, current);
    }
  }

  const entries = Array.from(aggregate.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.wordsFound - a.wordsFound;
    })
    .slice(0, DEFAULT_LEADERBOARD_LIMIT)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  leaderboardCache = { version: roomStateVersion, entries };
  return entries;
}

function getRoomOr404(roomId, res) {
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found." });
    return null;
  }
  return room;
}

function buildSettlementPayload(room) {
  const scoreboardMap = new Map(
    getRoomDerived(room).scoreboard.map((entry) => [
      entry.playerId,
      entry.score,
    ]),
  );
  return room.players.map((player) => ({
    playerId: player.id,
    walletAddress: player.walletAddress,
    score: scoreboardMap.get(player.id) || 0,
  }));
}

const SIGNED_MESSAGE_PREFIX = "wordpot-auth:";

async function verifyWalletSignature(walletAddress, signature, message) {
  if (!signature) return false;
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature,
    });
    return (
      recovered.toLowerCase() ===
      String(walletAddress || "")
        .trim()
        .toLowerCase()
    );
  } catch {
    return false;
  }
}

async function getValidatedPlayerOrError(
  room,
  playerId,
  walletAddress,
  signature,
  res,
) {
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

  if (signature) {
    const authMessage = `${SIGNED_MESSAGE_PREFIX}${playerId}:${normalizedWallet}`;
    const valid = await verifyWalletSignature(
      normalizedWallet,
      signature,
      authMessage,
    );
    if (!valid) {
      res.status(403).json({
        error:
          "Wallet signature verification failed. Connect your wallet and try again.",
      });
      return null;
    }
  }

  return player;
}

async function processRoomRefund(room, requestedByWalletAddress) {
  const paidPlayerIds = getPaidPlayerIds(room);
  const paidPlayers = room.players.filter((p) => paidPlayerIds.has(p.id));
  const paidPlayerAddresses = paidPlayers.map((p) => p.walletAddress);

  if (!paidPlayerAddresses.length) {
    throw new Error(
      "No paid players were found for this room, so no onchain refund can be processed.",
    );
  }

  if (
    !paidPlayerAddresses.some(
      (address) =>
        address.toLowerCase() ===
        String(requestedByWalletAddress || "").toLowerCase(),
    )
  ) {
    throw new Error("You are not in this room");
  }

  const cancelResult = await wordPotContract.cancelRoom(
    room.contractRoomId,
    paidPlayerAddresses,
  );

  room.status = "cancelled";
  room.cancelledAt = new Date().toISOString();
  room.contractCancelTx = cancelResult?.hash ?? null;
  room.contractCancelError = null;
  room.refundTransactions = room.refundTransactions || [];
  room.refundedWallets = Array.from(
    new Set([
      ...(room.refundedWallets || []),
      ...paidPlayerAddresses.map((a) => String(a || "").toLowerCase()),
    ]),
  );
  room.refundTransactions.push({
    hash: cancelResult?.hash ?? null,
    walletAddress: requestedByWalletAddress,
    amountWei: JOIN_PAYMENT_WEI,
    createdAt: new Date().toISOString(),
    kind: "contract_refund",
    refundedCount: paidPlayerAddresses.length,
  });
  pushSystemEvent(
    room,
    `Onchain refund sent for ${paidPlayerAddresses.length} player${paidPlayerAddresses.length === 1 ? "" : "s"}.`,
  );

  return {
    hash: cancelResult?.hash ?? null,
    gasEstimate: cancelResult?.gasEstimate ?? null,
    refundedCount: paidPlayerAddresses.length,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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
      contractReady: wordPotContract.enabled,
      contractOperatorAddress: wordPotContract.enabled
        ? wordPotContract.account
        : null,
      joinPaymentWei: JOIN_PAYMENT_WEI,
      joinPaymentDisplay: JOIN_PAYMENT_DISPLAY,
      joinMode:
        isWalletAddress(WORDPOT_CONTRACT_ADDRESS) && wordPotContract.enabled
          ? "contract_join"
          : "contract_unavailable",
      payoutMode:
        isWalletAddress(WORDPOT_CONTRACT_ADDRESS) && wordPotContract.enabled
          ? "contract_claim"
          : "contract_unavailable",
    },
  });
});

app.get("/api/leaderboard", (req, res) => {
  const walletAddress = String(req.query?.walletAddress || "").trim();
  const addressLower = walletAddress.toLowerCase();
  
  let playerRecord = null;
  if (isWalletAddress(walletAddress) && leaderboardSeasons.players[addressLower]) {
    playerRecord = leaderboardSeasons.players[addressLower];
  }

  res.json({
    entries: getCommunityLeaderboard(),
    seasonalEntries: getSeasonalLeaderboard(),
    seasonInfo: {
      activeSeason: leaderboardSeasons.activeSeason,
      seasonEndsAt: leaderboardSeasons.seasonEndsAt,
    },
    playerRecord,
    treasuryWallet: TREASURY_WALLET,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/stats", (_req, res) => {
  try {
    let totalPrize = 0;
    let playersOnline = 0;
    let activeRooms = 0;

    for (const room of rooms.values()) {
      if (room.status === "waiting" || room.status === "active") {
        activeRooms += 1;
        playersOnline += (room.players || []).length;
        totalPrize += Number(getRewardPool((room.players || []).length));
      }
    }

    // Try to read on-chain contract balance when available; fall back to aggregated room total
    (async () => {
      try {
        let onChain = null;
        if (
          wordPotContract?.enabled &&
          isWalletAddress(WORDPOT_CONTRACT_ADDRESS)
        ) {
          onChain = await wordPotContract.getContractBalance();
        }

        const prizePool = onChain || `${totalPrize.toFixed(4)} CELO`;

        res.json({
          prizePool,
          onChainBalance: onChain || null,
          playersOnline,
          activeRooms,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        res.json({
          prizePool: `${totalPrize.toFixed(4)} CELO`,
          onChainBalance: null,
          playersOnline,
          activeRooms,
          updatedAt: new Date().toISOString(),
        });
      }
    })();
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Unable to compute stats" });
  }
});

app.get("/api/rounds/practice", async (_req, res) => {
  try {
    const difficulty = String(_req.query?.difficulty || "medium")
      .trim()
      .toLowerCase();

    const round = await getDynamicRound(difficulty, recentUsedSourceWords);

    // Add to recent used history to prevent duplicates
    if (round && round.sourceWord) {
      recentUsedSourceWords.push(String(round.sourceWord).toUpperCase());
      while (recentUsedSourceWords.length > 20) {
        recentUsedSourceWords.shift();
      }
    }

    return res.json({ round });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to generate a practice round right now.",
    });
  }
});

app.get("/api/rounds/daily-challenge", async (_req, res) => {
  try {
    const walletAddress = String(_req.query?.walletAddress || "").trim();
    const difficulty = String(_req.query?.difficulty || "medium").trim().toLowerCase();

    if (!isWalletAddress(walletAddress)) {
      return res.status(400).json({
        error: "Connect a valid wallet before starting Daily Challenge.",
      });
    }

    const allowedDifficulties = ["easy", "medium", "hard"];
    if (!allowedDifficulties.includes(difficulty)) {
      return res.status(400).json({
        error: "Invalid difficulty level selected.",
      });
    }

    const DIFFICULTY_RULES = {
      easy: { targetScore: 20, rewardWei: "5000000000000000", rewardDisplay: "0.005 CELO" },
      medium: { targetScore: 40, rewardWei: "10000000000000000", rewardDisplay: "0.01 CELO" },
      hard: { targetScore: 60, rewardWei: "20000000000000000", rewardDisplay: "0.02 CELO" }
    };

    const rules = DIFFICULTY_RULES[difficulty];
    const round = await getDailyChallengeRound(difficulty);
    const sessionId = makeId("daily");
    const session = {
      id: sessionId,
      walletAddress,
      round,
      claimedWords: new Set(),
      score: 0,
      targetScore: rules.targetScore,
      rewardWei: rules.rewardWei,
      rewardDisplay: rules.rewardDisplay,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    dailyChallengeSessions.set(sessionId, session);

    return res.json({
      round: {
        id: sessionId,
        sourceWord: round.sourceWord,
        difficulty: round.difficulty,
        validWordsCount: round.validWords?.length || 0,
        targetScore: rules.targetScore,
        rewardDisplay: rules.rewardDisplay,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error.message ||
        "Unable to generate a daily challenge round right now.",
    });
  }
});

app.post("/api/daily/submit", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const sessionId = String(req.body?.sessionId || "").trim();
  const rawWord = normalizeWord(req.body?.word || "");

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  const session = dailyChallengeSessions.get(sessionId);
  if (!session) {
    return res
      .status(404)
      .json({ error: "Daily Challenge session not found. Start a new round." });
  }

  if (session.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return res.status(403).json({
      error: "This Daily Challenge session belongs to another wallet.",
    });
  }

  if (Date.now() > session.expiresAt) {
    dailyChallengeSessions.delete(sessionId);
    return res.status(410).json({
      error: "This Daily Challenge session expired. Start a new round.",
    });
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

  if (session.claimedWords.has(rawWord)) {
    return res.status(409).json({ error: "Already claimed in this round." });
  }

  if (!canBuildFromSource(rawWord, session.round.sourceWord)) {
    return res
      .status(400)
      .json({ error: "That word uses letters outside the source word." });
  }

  if (!session.round.validWords.includes(rawWord)) {
    return res
      .status(400)
      .json({ error: "That word is not valid for this round." });
  }

  const points = getWordScore(rawWord);
  session.claimedWords.add(rawWord);
  session.score += points;

  return res.json({
    ok: true,
    word: rawWord,
    score: points,
    totalScore: session.score,
    wordsFound: session.claimedWords.size,
    message: `Locked in ${rawWord} for +${points} points.`,
  });
});

app.post("/api/daily/claim", async (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();
  const sessionId = String(req.body?.sessionId || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  if (signature) {
    const authMessage = `${SIGNED_MESSAGE_PREFIX}daily-claim:${walletAddress}`;
    const validSig = await verifyWalletSignature(
      walletAddress,
      signature,
      authMessage,
    );
    if (!validSig) {
      return res.status(403).json({
        error:
          "Wallet signature verification failed. Connect your wallet and try again.",
      });
    }
  }

  const session = dailyChallengeSessions.get(sessionId);
  if (!session) {
    return res
      .status(404)
      .json({ error: "Daily Challenge session not found. Start a new round." });
  }

  if (session.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return res.status(403).json({
      error: "This Daily Challenge session belongs to another wallet.",
    });
  }

  const targetScore = session.targetScore || 40;
  if (session.score < targetScore) {
    return res.status(400).json({
      error: `You need at least ${targetScore} points to claim this daily reward.`,
    });
  }

  const claimKey = getTodayKey(walletAddress);
  if (dailyClaims.has(claimKey)) {
    return res.status(409).json({
      error:
        "You have already claimed your daily reward today. Come back tomorrow.",
    });
  }

  // Record that this wallet played now (used for 24h cooldown)
  try {
    const walletKey = walletAddress.toLowerCase();
    const nowIso = new Date().toISOString();
    dailyPlays.set(walletKey, { playedAt: nowIso });
    persistDailyPlays();
  } catch (err) {
    // ignore
  }

  if (!wordPotContract.enabled || !isWalletAddress(WORDPOT_CONTRACT_ADDRESS)) {
    return res.status(503).json({
      error: "Daily rewards are not available right now. Try again later.",
    });
  }

  if (
    isWalletAddress(wordPotContract.account) &&
    wordPotContract.account.toLowerCase() === walletAddress.toLowerCase()
  ) {
    return res.status(400).json({
      error:
        "Daily rewards must be claimed with a player wallet, not the treasury/operator wallet.",
    });
  }

  try {
    const rewardWei = session.rewardWei || "10000000000000000";
    const rewardDisplay = session.rewardDisplay || "0.01 CELO";
    const txHash = await wordPotContract.sendReward(
      walletAddress,
      rewardWei,
    );
    dailyClaims.set(claimKey, {
      walletAddress,
      sessionId,
      score: session.score,
      claimedAt: new Date().toISOString(),
      txHash,
    });
    persistDailyClaims();
    dailyChallengeSessions.delete(sessionId);
    return res.json({
      ok: true,
      txHash,
      amount: rewardDisplay,
      score: session.score,
      explorerUrl: `https://celoscan.io/tx/${txHash}`,
    });
  } catch (error) {
    console.error("[daily-claim] failed:", error.message);
    return res.status(502).json({
      error: "Unable to send the daily reward right now. Please try again.",
    });
  }
});

app.get("/api/daily/status", (req, res) => {
  const walletAddress = String(req.query?.walletAddress || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  const claimKey = getTodayKey(walletAddress);
  const claimed = dailyClaims.has(claimKey);
  const claimEntry = claimed ? dailyClaims.get(claimKey) : null;

  const walletKey = walletAddress.toLowerCase();
  const playEntry = dailyPlays.get(walletKey);
  let played = false;
  let nextAvailableAt = null;
  if (playEntry?.playedAt) {
    const nextTs = new Date(playEntry.playedAt).getTime() + 24 * 60 * 60 * 1000;
    nextAvailableAt = new Date(nextTs).toISOString();
    played = Date.now() < nextTs;
  }

  return res.json({
    claimed,
    played,
    claimedAt: claimEntry?.claimedAt || null,
    txHash: claimEntry?.txHash || null,
    policy: "rolling-24h",
    nextAvailableAt,
    treasuryWallet: TREASURY_WALLET,
  });
});

// --- Admin debug endpoints for daily plays ---
app.get("/api/debug/daily-plays", (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const entries = Array.from(dailyPlays.entries()).map(([wallet, v]) => ({
    walletAddress: wallet,
    playedAt: v?.playedAt || null,
  }));

  return res.json({ entries });
});

app.post("/api/debug/daily-plays/clear", (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const walletAddress = String(req.body?.walletAddress || "")
    .trim()
    .toLowerCase();
  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  const key = walletAddress;
  const existed = dailyPlays.delete(key);
  try {
    persistDailyPlays();
  } catch (err) {
    // ignore
  }

  return res.json({ ok: true, removed: !!existed });
});

app.post("/api/daily/play", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  const walletKey = walletAddress.toLowerCase();
  const entry = dailyPlays.get(walletKey);
  const now = Date.now();
  if (entry?.playedAt) {
    const nextTs = new Date(entry.playedAt).getTime() + 24 * 60 * 60 * 1000;
    if (now < nextTs) {
      return res.status(409).json({
        error:
          "You have already played the Daily Challenge within the last 24 hours.",
        played: true,
        nextAvailableAt: new Date(nextTs).toISOString(),
      });
    }
  }

  dailyPlays.set(walletKey, { playedAt: new Date().toISOString() });
  try {
    persistDailyPlays();
  } catch (err) {
    // ignore
  }

  const nextTs =
    new Date(dailyPlays.get(walletKey).playedAt).getTime() +
    24 * 60 * 60 * 1000;
  return res.json({
    ok: true,
    played: true,
    nextAvailableAt: new Date(nextTs).toISOString(),
  });
});

// FIX: contract room created in background so player joins instantly
app.post("/api/rooms/quick-match", async (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  if (signature) {
    const authMessage = `${SIGNED_MESSAGE_PREFIX}quick-match:${walletAddress}`;
    const validSig = await verifyWalletSignature(
      walletAddress,
      signature,
      authMessage,
    );
    if (!validSig) {
      return res.status(403).json({
        error:
          "Wallet signature verification failed. Connect your wallet and try again.",
      });
    }
  }

  let room = getWaitingRoom();

  if (!room) {
    if (
      REQUIRE_ONCHAIN_ROOM &&
      (!isWalletAddress(WORDPOT_CONTRACT_ADDRESS) || !wordPotContract.enabled)
    ) {
      return res.status(503).json({
        error:
          "Live rooms are waiting for the WordPot contract operator to be configured. Restart the server with the contract key and try again.",
      });
    }

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
      contractRoomId: null,
      contractRoomCreateTx: null,
      _contractRoomPending: false,
    };

    rooms.set(room.id, room);

    // Create contract room in background — player lands in lobby immediately
    if (wordPotContract.enabled && isWalletAddress(WORDPOT_CONTRACT_ADDRESS)) {
      room._contractRoomPending = true;
      wordPotContract
        .createRoom(JOIN_PAYMENT_WEI)
        .then((contractRoom) => {
          room.contractRoomId = contractRoom?.roomId ?? null;
          room.contractRoomCreateTx = contractRoom?.hash ?? null;
          room._contractRoomPending = false;
          if (room.contractRoomId) {
            pushSystemEvent(
              room,
              `Onchain room ${room.contractRoomId} opened on WordPotArena`,
            );
          }
          markRoomDirty(room);
        })
        .catch((error) => {
          console.error(
            "Background contract room creation failed:",
            error.message,
          );
          room._contractRoomPending = false;
          pushSystemEvent(
            room,
            "Onchain room setup failed. Contract joins may be unavailable for this room.",
          );
          markRoomDirty(room);
        });
    } else if (REQUIRE_ONCHAIN_ROOM) {
      rooms.delete(room.id);
      return res.status(503).json({
        error:
          "Live rooms are temporarily unavailable until the onchain room contract is ready.",
      });
    }
  }

  // TOCTOU-safe join with per-room lock
  const lowerWallet = walletAddress.toLowerCase();
  const lockKey = `${room.id}:${lowerWallet}`;

  if (!roomJoinLocks.has(room.id)) {
    roomJoinLocks.set(room.id, new Set());
  }
  const activeJoins = roomJoinLocks.get(room.id);

  if (activeJoins.has(lowerWallet)) {
    return res
      .status(429)
      .json({ error: "Join already in progress. Please wait." });
  }

  activeJoins.add(lowerWallet);

  try {
    const existingPlayer = room.players.find(
      (player) => player.walletAddress.toLowerCase() === lowerWallet,
    );

    if (existingPlayer) {
      activeJoins.delete(lowerWallet);
      return res.status(200).json({
        room: getRoomSummary(room),
        playerId: existingPlayer.id,
        restored: true,
      });
    }

    const player = {
      id: room.players.length === 0 ? room.hostPlayerId : makeId("player"),
      walletAddress,
      joinedAt: new Date().toISOString(),
    };

    room.players.push(player);
    pushSystemEvent(
      room,
      `${shortenAddress(player.walletAddress)} joined the game`,
    );

    activeJoins.delete(lowerWallet);
    if (activeJoins.size === 0) {
      roomJoinLocks.delete(room.id);
    }

    return res
      .status(201)
      .json({ room: getRoomSummary(room), playerId: player.id });
  } catch (error) {
    activeJoins.delete(lowerWallet);
    if (activeJoins.size === 0) {
      roomJoinLocks.delete(room.id);
    }
    throw error;
  }
});

app.post("/api/rooms/:roomId/join", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
  }

  if (signature) {
    const authMessage = `${SIGNED_MESSAGE_PREFIX}join:${walletAddress}`;
    const validSig = await verifyWalletSignature(
      walletAddress,
      signature,
      authMessage,
    );
    if (!validSig) {
      return res.status(403).json({
        error:
          "Wallet signature verification failed. Connect your wallet and try again.",
      });
    }
  }

  if (room.status === "expired") {
    return res.status(410).json({
      error: "This room has expired. Ask your friend to create a new one.",
    });
  }

  if (room.status !== "waiting") {
    return res
      .status(400)
      .json({ error: "This room is no longer accepting players." });
  }

  if (room.players.length >= MAX_PLAYERS) {
    return res.status(400).json({ error: "This room is already full." });
  }

  // TOCTOU-safe join with per-room lock
  const lowerWallet = walletAddress.toLowerCase();
  const lockKey = `${room.id}:${lowerWallet}`;

  if (!roomJoinLocks.has(room.id)) {
    roomJoinLocks.set(room.id, new Set());
  }
  const activeJoins = roomJoinLocks.get(room.id);

  if (activeJoins.has(lowerWallet)) {
    return res
      .status(429)
      .json({ error: "Join already in progress. Please wait." });
  }

  activeJoins.add(lowerWallet);

  try {
    const existingPlayer = room.players.find(
      (player) => player.walletAddress.toLowerCase() === lowerWallet,
    );

    if (existingPlayer) {
      activeJoins.delete(lowerWallet);
      if (activeJoins.size === 0) {
        roomJoinLocks.delete(room.id);
      }
      return res.status(200).json({
        room: getRoomSummary(room),
        playerId: existingPlayer.id,
        restored: true,
      });
    }

    const player = {
      id: makeId("player"),
      walletAddress,
      joinedAt: new Date().toISOString(),
    };

    room.players.push(player);
    pushSystemEvent(
      room,
      `${shortenAddress(player.walletAddress)} joined the game`,
    );

    activeJoins.delete(lowerWallet);
    if (activeJoins.size === 0) {
      roomJoinLocks.delete(room.id);
    }

    return res
      .status(201)
      .json({ room: getRoomSummary(room), playerId: player.id });
  } catch (error) {
    activeJoins.delete(lowerWallet);
    if (activeJoins.size === 0) {
      roomJoinLocks.delete(room.id);
    }
    throw error;
  }
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  return res.json({
    room: getRoomSummary(room, {
      feedLimit: req.query?.feedLimit,
      txLimit: req.query?.txLimit,
    }),
  });
});

app.post("/api/rooms/:roomId/start", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  if (room.status === "expired") {
    return res
      .status(400)
      .json({ error: "This room has expired. Go back and start a new one." });
  }

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
  if (!player) return;

  if (room.status !== "waiting") {
    return res.status(400).json({ error: "This room has already started." });
  }

  if (room.hostPlayerId !== player.id) {
    return res
      .status(403)
      .json({ error: "Only the host can start this room." });
  }

  if (room.players.length < MIN_PLAYERS) {
    return res.status(400).json({
      error: `At least ${MIN_PLAYERS} players are needed before the room can start.`,
    });
  }

  const unpaidPlayers = room.players.filter(
    (entry) => !hasPlayerPaid(room, entry.id),
  );
  if (unpaidPlayers.length) {
    return res.status(400).json({
      error: `All players must complete the onchain join payment before the room starts. ${unpaidPlayers.length} unpaid.`,
    });
  }

  const roundSeed = await getDynamicRound("hard", recentUsedSourceWords);
  if (roundSeed && roundSeed.sourceWord) {
    recentUsedSourceWords.push(String(roundSeed.sourceWord).toUpperCase());
    while (recentUsedSourceWords.length > 20) {
      recentUsedSourceWords.shift();
    }
  }
  room.status = "active";
  room.startedAt = new Date().toISOString();
  room.endsAt = Date.now() + ROUND_SECONDS * 1000;
  room.sourceWord = roundSeed.sourceWord;
  room.validWords = roundSeed.validWords;
  room.submissions = [];
  room.events = [];
  room._claimedWords = new Set();
  pushSystemEvent(room, "Game starting now");

  return res.json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/submit", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const rawWord = normalizeWord(req.body?.word);

  settleRoom(room);

  if (room.status !== "active") {
    return res.status(400).json({ error: "This room is not active." });
  }

  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
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
    markRoomDirty(room);
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

  room._claimedWords = room._claimedWords || new Set();
  if (room._claimedWords.has(rawWord)) {
    logEvent({ status: "rejected", word: rawWord, reason: "Already used" });
    return res.status(409).json({ error: "Already used by another player." });
  }

  if (!canBuildFromSource(rawWord, room.sourceWord)) {
    logEvent({
      status: "rejected",
      word: rawWord,
      reason: "Outside source word",
    });
    return res
      .status(400)
      .json({ error: "That word cannot be formed from the source word." });
  }

  if (!room.validWords.includes(rawWord)) {
    logEvent({ status: "rejected", word: rawWord, reason: "Invalid word" });
    return res
      .status(400)
      .json({ error: "That word is not valid for this round." });
  }

  const submission = {
    playerId,
    walletAddress: player.walletAddress,
    word: rawWord,
    score: getWordScore(rawWord),
    createdAt: new Date().toISOString(),
  };

  room.submissions.push(submission);
  room._claimedWords.add(rawWord);
  markRoomDirty(room);
  logEvent({ status: "accepted", word: rawWord, score: submission.score });

  return res.status(201).json({ submission, room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/join-tx", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();
  const amount = String(req.body?.amount || JOIN_PAYMENT_DISPLAY).trim();
  const mode = String(req.body?.mode || "contract_join").trim();
  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
  if (!player) return;

  if (!isTxHash(txHash)) {
    return res
      .status(400)
      .json({ error: "A valid transaction hash is required." });
  }

  const duplicate = room.joinTransactions.some(
    (entry) => entry.txHash.toLowerCase() === txHash.toLowerCase(),
  );
  if (!duplicate) {
    room.joinTransactions.push({
      playerId,
      walletAddress: player.walletAddress,
      txHash,
      amount,
      mode,
      createdAt: new Date().toISOString(),
    });
    pushSystemEvent(
      room,
      `${shortenAddress(player.walletAddress)} funded the room onchain`,
    );
  }

  return res.status(201).json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/claim-tx", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();
  const amount = String(req.body?.amount || "0").trim();
  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {
    return res
      .status(400)
      .json({ error: "Rewards can only be claimed after the room ends." });
  }

  if (!isTxHash(txHash)) {
    return res
      .status(400)
      .json({ error: "A valid transaction hash is required." });
  }

  const duplicate = room.claimTransactions.some(
    (entry) => entry.txHash.toLowerCase() === txHash.toLowerCase(),
  );
  if (!duplicate) {
    room.claimTransactions.push({
      playerId,
      walletAddress: player.walletAddress,
      txHash,
      amount,
      createdAt: new Date().toISOString(),
    });
    pushSystemEvent(
      room,
      `${shortenAddress(player.walletAddress)} claimed a reward onchain`,
    );
  }

  return res.status(201).json({ room: getRoomSummary(room) });
});

app.post("/api/rooms/:roomId/settle", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;
  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {
    return res.status(400).json({
      error: "This room is not finished yet, so it cannot be settled onchain.",
    });
  }

  if (room.contractSettledAt) {
    return res.status(200).json({ room: getRoomSummary(room), settled: true });
  }

  if (
    !wordPotContract.enabled ||
    !isWalletAddress(WORDPOT_CONTRACT_ADDRESS) ||
    !room.contractRoomId
  ) {
    return res.status(503).json({
      error: "Onchain settlement is not available for this room yet.",
    });
  }

  try {
    const settlement = buildSettlementPayload(room);
    const settleResult = await wordPotContract.settleRoom(
      room.contractRoomId,
      settlement.map((entry) => entry.walletAddress),
      settlement.map((entry) => entry.score),
    );

    room.contractSettleTx = settleResult?.hash ?? null;
    room.contractSettledAt = new Date().toISOString();
    room.contractSettleError = null;
    pushSystemEvent(
      room,
      "Final scores were settled onchain. Claims are now live.",
    );

    return res.status(200).json({ room: getRoomSummary(room), settled: true });
  } catch (error) {
    console.error("Contract settle failed:", error.message);
    room.contractSettleError = error.message;
    markRoomDirty(room);
    return res.status(502).json({
      error: error.message || "Unable to settle the room onchain right now.",
    });
  }
});

app.post("/api/rooms/:roomId/cancel", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(
    room,
    playerId,
    walletAddress,
    signature,
    res,
  );
  if (!player) return;

  if (room.hostPlayerId !== player.id) {
    return res
      .status(403)
      .json({ error: "Only the host can cancel this room." });
  }

  if (room.status !== "waiting" && room.status !== "active") {
    return res
      .status(400)
      .json({ error: "This room cannot be cancelled in its current state." });
  }

  if (room.cancelledAt) {
    return res
      .status(400)
      .json({ error: "This room has already been cancelled." });
  }

  if (getPaidPlayerIds(room).size > 0) {
    if (
      !wordPotContract.enabled ||
      !isWalletAddress(WORDPOT_CONTRACT_ADDRESS) ||
      !room.contractRoomId
    ) {
      return res
        .status(503)
        .json({ error: "Contract refund is not available for this room." });
    }

    try {
      const result = await processRoomRefund(room, player.walletAddress);
      return res.status(200).json({
        room: getRoomSummary(room),
        txHash: result.hash,
        explorerUrl: getCeloExplorerTxUrl(result.hash),
      });
    } catch (error) {
      console.error("[cancel-room] refund failed:", error.message);
      room.contractCancelError = error.message;
      markRoomDirty(room);
      return res
        .status(502)
        .json({ error: normalizeRefundErrorMessage(error.message) });
    }
  }

  room.status = "cancelled";
  room.cancelledAt = new Date().toISOString();
  pushSystemEvent(room, "Room cancelled by host.");

  return res.status(200).json({ room: getRoomSummary(room) });
});

app.post("/api/leaderboard/season/register", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid wallet address is required." });
  }

  const addressLower = walletAddress.toLowerCase();
  if (!leaderboardSeasons.players[addressLower]) {
    leaderboardSeasons.players[addressLower] = {
      walletAddress,
      registered: false,
      score: 0,
      wordsFound: 0,
      gamesPlayed: 0,
      wins: 0,
      boosterGamesRemaining: 0,
    };
  }

  const record = leaderboardSeasons.players[addressLower];
  record.registered = true;
  if (txHash) {
    record.txHash = txHash;
  }
  record.registeredAt = new Date().toISOString();

  persistLeaderboardSeasons();

  return res.json({
    ok: true,
    message: "Successfully registered for Season 1!",
    player: record,
  });
});

app.post("/api/leaderboard/booster/buy", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const txHash = String(req.body?.txHash || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid wallet address is required." });
  }

  const addressLower = walletAddress.toLowerCase();
  if (!leaderboardSeasons.players[addressLower]) {
    leaderboardSeasons.players[addressLower] = {
      walletAddress,
      registered: false,
      score: 0,
      wordsFound: 0,
      gamesPlayed: 0,
      wins: 0,
      boosterGamesRemaining: 0,
    };
  }

  const record = leaderboardSeasons.players[addressLower];
  record.boosterGamesRemaining = (record.boosterGamesRemaining || 0) + 3;
  if (txHash) {
    record.boosterTxHash = txHash;
  }
  record.boosterPurchasedAt = new Date().toISOString();

  persistLeaderboardSeasons();

  return res.json({
    ok: true,
    message: "Successfully purchased a 3-game 2x Score Booster!",
    player: record,
  });
});

app.post("/api/daily/retry-purchase", (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res.status(400).json({ error: "A valid wallet address is required." });
  }

  const walletKey = walletAddress.toLowerCase();
  let clearedCount = 0;
  for (const key of dailyPlays.keys()) {
    if (key.toLowerCase() === walletKey) {
      dailyPlays.delete(key);
      clearedCount++;
    }
  }

  if (clearedCount > 0) {
    try {
      persistDailyPlays();
    } catch (err) {
      console.warn("Failed to persist daily plays:", err.message);
    }
  }

  return res.json({
    ok: true,
    message: "Retry purchased! Daily Challenge cooldown cleared.",
    cleared: clearedCount > 0,
  });
});

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});
