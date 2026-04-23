import cors from "cors";
import dotenv from "dotenv";
import express from "express";
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
const rooms = new Map();
const wordPotContract = createWordPotContractService({
  contractAddress: WORDPOT_CONTRACT_ADDRESS,
  operatorPrivateKey: CONTRACT_OPERATOR_PRIVATE_KEY,
  rpcUrl: CELO_MAINNET_RPC_URL,
});

app.use(cors());
app.use(express.json());

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRewardPool(playerCount) {
  return (
    (playerCount * (Number(JOIN_PAYMENT_WEI) / 1_000_000_000_000_000_000)) * 0.9
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
        wordsFound: room.submissions.filter(
          (entry) => entry.playerId === player.id,
        ).length,
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
  return (room.claimTransactions || []).some(
    (entry) => entry.playerId === playerId,
  );
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

function checkRoomTimeout(room) {
  // Auto-cancel rooms waiting longer than 5 minutes with insufficient players
  if (room.status !== "waiting") return;
  if (!room.createdAt) return;

  const MIN_PLAYERS = 2;
  const WAIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const createdTime = new Date(room.createdAt).getTime();
  const elapsedTime = Date.now() - createdTime;

  // If 5 minutes have passed and we don't have minimum players, auto-cancel
  if (elapsedTime > WAIT_TIMEOUT_MS && room.players.length < MIN_PLAYERS) {
    return true; // Should be cancelled
  }

  return false;
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
    rewardPool: `${getRewardPool(room.players.length)} CELO`,
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
      contractRoomId: room.contractRoomId || null,
      contractRoomCreateTx: room.contractRoomCreateTx || null,
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
      joinTransactions: room.joinTransactions || [],
      claimTransactions: room.claimTransactions || [],
      refundTransactions: room.refundTransactions || [],
      paidPlayersCount: getPaidPlayerIds(room).size,
    },
    cancelledAt: room.cancelledAt || null,
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

      if (
        scoreboard[0]?.walletAddress === entry.walletAddress &&
        entry.score > 0
      ) {
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

app.post("/api/rooms/quick-match", async (req, res) => {
  const walletAddress = String(req.body?.walletAddress || "").trim();

  if (!isWalletAddress(walletAddress)) {
    return res
      .status(400)
      .json({ error: "A valid wallet address is required." });
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
    };

    if (wordPotContract.enabled && isWalletAddress(WORDPOT_CONTRACT_ADDRESS)) {
      try {
        const contractRoom = await wordPotContract.createRoom(JOIN_PAYMENT_WEI);
        room.contractRoomId = contractRoom?.roomId ?? null;
        room.contractRoomCreateTx = contractRoom?.hash ?? null;

        if (!room.contractRoomId) {
          throw new Error("Contract room was created without a room id.");
        }

        pushSystemEvent(
          room,
          room.contractRoomId
            ? `Onchain room ${room.contractRoomId} opened on WordPotArena`
            : "Onchain room creation submitted",
        );
      } catch (error) {
        console.error("Unable to create onchain room", error);
        return res.status(502).json({
          error:
            "Unable to open this room onchain right now. No player was charged. Please try again.",
        });
      }
    } else if (REQUIRE_ONCHAIN_ROOM) {
      return res.status(503).json({
        error:
          "Live rooms are temporarily unavailable until the onchain room contract is ready.",
      });
    }

    rooms.set(room.id, room);
  }

  const existingPlayer = room.players.find(
    (player) =>
      player.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (existingPlayer) {
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

  const alreadyClaimed = room.submissions.some(
    (entry) => entry.word === rawWord,
  );
  if (alreadyClaimed) {
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
  const mode = String(req.body?.mode || "contract_join").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
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

app.post("/api/rooms/:roomId/cancel", async (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);
  if (!room) return;

  const playerId = String(req.body?.playerId || "").trim();
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  // Only host can cancel
  if (room.hostPlayerId !== player.id) {
    return res
      .status(403)
      .json({ error: "Only the host can cancel this room." });
  }

  // Can only cancel while waiting or before game ends
  if (room.status !== "waiting" && room.status !== "active") {
    return res
      .status(400)
      .json({ error: "This room cannot be cancelled in its current state." });
  }

  // Already cancelled
  if (room.cancelledAt) {
    return res
      .status(400)
      .json({ error: "This room has already been cancelled." });
  }

  // Mark room as cancelled
  room.status = "cancelled";
  room.cancelledAt = new Date().toISOString();
  pushSystemEvent(
    room,
    "Room cancelled by host. All players will be refunded.",
  );

  // Collect all players who paid and need refunds
  const paidPlayerIds = getPaidPlayerIds(room);
  const refundedPlayers = [];

  if (
    !wordPotContract.enabled ||
    !isWalletAddress(WORDPOT_CONTRACT_ADDRESS) ||
    !room.contractRoomId
  ) {
    return res.status(503).json({
      error:
        "This room cannot refund onchain because the contract room is missing. Open a fresh room after the server is fully configured.",
    });
  }

  try {
    const playerAddresses = room.players.map((p) => p.walletAddress);
    const cancelResult = await wordPotContract.cancelRoom(
      room.contractRoomId,
      playerAddresses,
    );
    room.contractCancelTx = cancelResult?.hash ?? null;
    room.contractCancelError = null;
    refundedPlayers.push(...playerAddresses);
    pushSystemEvent(
      room,
      `Onchain refund sent for ${playerAddresses.length} player${playerAddresses.length === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    console.error("Contract cancel failed:", error.message);
    room.contractCancelError = error.message;
    return res.status(502).json({
      error:
        error.message ||
        "Onchain refund failed. No treasury fallback was used, so please retry.",
    });
  }

  return res.status(200).json({ room: getRoomSummary(room) });
});

function shortenAddress(value) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

app.listen(port, () => {
  console.log(`WordPot server listening on http://localhost:${port}`);
});
