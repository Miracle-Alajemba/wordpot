import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_RULES,
  CONTRACT_ADDRESSES,
  DIFFICULTY_TIERS,
} from "../src/config/constants.js";

test("GAME_RULES exports expected default room parameters", () => {
  assert.equal(GAME_RULES.DEFAULT_ROUND_DURATION_SECONDS, 60);
  assert.equal(GAME_RULES.LOBBY_EXPIRY_SECONDS, 240);
  assert.equal(GAME_RULES.TREASURY_FEE_BPS, 1000);
});

test("CONTRACT_ADDRESSES holds valid Celo mainnet contract addresses", () => {
  assert.match(CONTRACT_ADDRESSES.MAINNET_ROOM_ESCROW, /^0x[a-fA-F0-9]{40}$/);
  assert.match(CONTRACT_ADDRESSES.MAINNET_DAILY_CHALLENGE, /^0x[a-fA-F0-9]{40}$/);
});

test("DIFFICULTY_TIERS defines easy, medium, and hard modes", () => {
  assert.equal(DIFFICULTY_TIERS.EASY, "easy");
  assert.equal(DIFFICULTY_TIERS.MEDIUM, "medium");
  assert.equal(DIFFICULTY_TIERS.HARD, "hard");
});
