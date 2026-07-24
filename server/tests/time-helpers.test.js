import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  getUtcDateKey,
  secondsUntilUtcMidnight,
} from "../src/utils/time-helpers.js";

test("formatCountdown formats seconds into MM:SS correctly", () => {
  assert.equal(formatCountdown(240), "04:00");
  assert.equal(formatCountdown(65), "01:05");
  assert.equal(formatCountdown(9), "00:09");
  assert.equal(formatCountdown(0), "00:00");
  assert.equal(formatCountdown(-10), "00:00");
});

test("getUtcDateKey returns ISO YYYY-MM-DD date string", () => {
  const d = new Date(Date.UTC(2026, 6, 24, 12, 0, 0));
  assert.equal(getUtcDateKey(d), "2026-07-24");
});

test("secondsUntilUtcMidnight calculates seconds remaining until midnight", () => {
  const now = new Date(Date.UTC(2026, 6, 24, 23, 59, 0)); // 60s before midnight
  assert.equal(secondsUntilUtcMidnight(now), 60);
});
