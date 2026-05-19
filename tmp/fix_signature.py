import re

with open("server/src/index.js", "r") as f:
    content = f.read()

# 1. Add recoverMessageAddress import
content = content.replace(
    'import zlib from "zlib";\nimport { canBuildFromSource, getDynamicRound } from "./rounds.js";',
    'import zlib from "zlib";\nimport { recoverMessageAddress } from "viem";\nimport { canBuildFromSource, getDynamicRound } from "./rounds.js";'
)

# 2. Add verifyWalletSignature helper and modify getValidatedPlayerOrError
old_helper = """function getValidatedPlayerOrError(room, playerId, walletAddress, res) {
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
}"""

new_helper = """const SIGNED_MESSAGE_PREFIX = "wordpot-auth:";

async function verifyWalletSignature(walletAddress, signature, message) {
  if (!signature) return false;
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature,
    });
    return recovered.toLowerCase() === String(walletAddress || "").trim().toLowerCase();
  } catch {
    return false;
  }
}

async function getValidatedPlayerOrError(room, playerId, walletAddress, signature, res) {
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
    const valid = await verifyWalletSignature(normalizedWallet, signature, authMessage);
    if (!valid) {
      res.status(403).json({ error: "Wallet signature verification failed. Connect your wallet and try again." });
      return null;
    }
  }

  return player;
}"""

if old_helper not in content:
    print("ERROR: Could not find getValidatedPlayerOrError in content")
    idx = content.find("getValidatedPlayerOrError")
    if idx >= 0:
        print(f"Found at index {idx}")
        print(repr(content[idx:idx+600]))
    exit(1)

content = content.replace(old_helper, new_helper, 1)
print("Replaced getValidatedPlayerOrError")

# 3. Update callers - start route
old_start = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (room.status !== "waiting") {"""
new_start = """  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  if (room.status !== "waiting") {"""
if old_start in content:
    content = content.replace(old_start, new_start, 1)
    print("Updated start route")
else:
    print("WARNING: Could not find start route caller")

# submit route
old_submit = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  function logEvent({ status, word, score = 0, reason = "" }) {"""
new_submit = """  const signature = String(req.body?.signature || "").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  function logEvent({ status, word, score = 0, reason = "" }) {"""
if old_submit in content:
    content = content.replace(old_submit, new_submit, 1)
    print("Updated submit route")
else:
    print("WARNING: Could not find submit route caller")

# join-tx route
old_join_tx = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (!isTxHash(txHash)) {"""
new_join_tx = """  const signature = String(req.body?.signature || "").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  if (!isTxHash(txHash)) {"""
if old_join_tx in content:
    content = content.replace(old_join_tx, new_join_tx, 1)
    print("Updated join-tx route")
else:
    print("WARNING: Could not find join-tx route caller")

# claim-tx route
old_claim_tx = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {"""
new_claim_tx = """  const signature = String(req.body?.signature || "").trim();
  const player = getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {"""
if old_claim_tx in content:
    content = content.replace(old_claim_tx, new_claim_tx, 1)
    print("Updated claim-tx route")
else:
    print("WARNING: Could not find claim-tx route caller")

# settle route
old_settle = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {"""
new_settle = """  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  settleRoom(room);

  if (room.status !== "finished") {"""
if old_settle in content:
    content = content.replace(old_settle, new_settle, 1)
    print("Updated settle route")
else:
    print("WARNING: Could not find settle route caller")

# cancel route
old_cancel = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (room.hostPlayerId !== player.id) {"""
new_cancel = """  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  if (room.hostPlayerId !== player.id) {"""
if old_cancel in content:
    content = content.replace(old_cancel, new_cancel, 1)
    print("Updated cancel route")
else:
    print("WARNING: Could not find cancel route caller")

# refund route
old_refund = """  const player = getValidatedPlayerOrError(room, playerId, walletAddress, res);
  if (!player) return;

  if (room.status !== "waiting" && room.status !== "cancelled") {"""
new_refund = """  const signature = String(req.body?.signature || "").trim();
  const player = await getValidatedPlayerOrError(room, playerId, walletAddress, signature, res);
  if (!player) return;

  if (room.status !== "waiting" && room.status !== "cancelled") {"""
if old_refund in content:
    content = content.replace(old_refund, new_refund, 1)
    print("Updated refund route")
else:
    print("WARNING: Could not find refund route caller")

# Make routes async where needed
# submit route
content = content.replace(
    'app.post("/api/rooms/:roomId/submit", (req, res) => {',
    'app.post("/api/rooms/:roomId/submit", async (req, res) => {'
)
print("Made submit route async")

# join-tx route
content = content.replace(
    'app.post("/api/rooms/:roomId/join-tx", (req, res) => {',
    'app.post("/api/rooms/:roomId/join-tx", async (req, res) => {'
)
print("Made join-tx route async")

# claim-tx route
content = content.replace(
    'app.post("/api/rooms/:roomId/claim-tx", (req, res) => {',
    'app.post("/api/rooms/:roomId/claim-tx", async (req, res) => {'
)
print("Made claim-tx route async")

with open("server/src/index.js", "w") as f:
    f.write(content)

print("\nAll changes applied successfully!")