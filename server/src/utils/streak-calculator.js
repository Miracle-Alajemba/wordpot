/**
 * Streak tracking logic for WordPot Daily Challenge.
 */

/**
 * Calculate updated consecutive daily play streak.
 * @param {string|null} lastPlayDate - ISO date string YYYY-MM-DD of previous play
 * @param {string} currentDate - ISO date string YYYY-MM-DD of current play
 * @param {number} currentStreak - Existing streak count
 * @returns {number} Updated consecutive streak
 */
export function calculateUpdatedStreak(lastPlayDate, currentDate, currentStreak = 0) {
  if (!currentDate || typeof currentDate !== "string") return 1;
  if (!lastPlayDate || typeof lastPlayDate !== "string") return 1;

  if (lastPlayDate === currentDate) {
    return Math.max(1, currentStreak);
  }

  const last = new Date(`${lastPlayDate}T00:00:00Z`).getTime();
  const curr = new Date(`${currentDate}T00:00:00Z`).getTime();
  const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return currentStreak + 1;
  }

  // Streak reset if missed more than 1 day
  return 1;
}
