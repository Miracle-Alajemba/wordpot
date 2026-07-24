/**
 * Client UI formatting utilities for WordPot.
 */

/**
 * Format score number with commas for display.
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
  if (typeof score !== "number" || isNaN(score)) return "0";
  return score.toLocaleString("en-US");
}

/**
 * Format CELO token amount with symbol suffix.
 * @param {number} amount
 * @returns {string}
 */
export function formatCeloAmount(amount) {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    return "0 CELO";
  }
  return `${amount.toFixed(2)} CELO`;
}

/**
 * Shorten EVM wallet address to 0x1234...5678 format.
 * @param {string} address
 * @returns {string}
 */
export function shortenAddress(address) {
  if (!address || typeof address !== "string" || address.length < 10) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
