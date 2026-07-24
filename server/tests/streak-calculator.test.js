import test from "node:test";
import assert from "node:assert/strict";
import { calculateUpdatedStreak } from "../src/utils/streak-calculator.js";

test("calculateUpdatedStreak increments streak when playing on consecutive days", () => {
  const streak = calculateUpdatedStreak("2026-07-23", "2026-07-24", 5);
  assert.equal(streak, 6);
});

test("calculateUpdatedStreak retains streak when playing on same day", () => {
  const streak = calculateUpdatedStreak("2026-07-24", "2026-07-24", 3);
  assert.equal(streak, 3);
});

test("calculateUpdatedStreak resets streak to 1 when a day is skipped", () => {
  const streak = calculateUpdatedStreak("2026-07-20", "2026-07-24", 10);
  assert.equal(streak, 1);
});

test("calculateUpdatedStreak returns 1 for first time players", () => {
  const streak = calculateUpdatedStreak(null, "2026-07-24", 0);
  assert.equal(streak, 1);
});
