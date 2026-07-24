/**
 * Time formatting and countdown helpers for WordPot game lobbies and Daily Challenges.
 */

/**
 * Format remaining seconds into MM:SS string display.
 * @param {number} seconds
 * @returns {string}
 */
export function formatCountdown(seconds) {
  if (typeof seconds !== "number" || seconds <= 0 || isNaN(seconds)) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Get current UTC date key formatted as YYYY-MM-DD for daily challenge rate limits.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getUtcDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate seconds remaining until UTC midnight (next Daily Challenge reset).
 * @param {Date} [now=new Date()]
 * @returns {number}
 */
export function secondsUntilUtcMidnight(now = new Date()) {
  const current = now instanceof Date ? now : new Date();
  const nextMidnight = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(0, Math.floor((nextMidnight.getTime() - current.getTime()) / 1000));
}
