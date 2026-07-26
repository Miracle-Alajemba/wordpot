/**
 * EVM Wallet Address Formatting & Validation Utility
 */

/**
 * Truncates EVM wallet address (e.g. "0x1234...abcd").
 * @param {string} address
 * @param {number} [startChars=6]
 * @param {number} [endChars=4]
 * @returns {string}
 */
export function truncateAddress(address, startChars = 6, endChars = 4) {
  if (!address || typeof address !== "string") return "";
  const str = address.trim();
  if (str.length <= startChars + endChars) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/**
 * Validates if string is a valid EVM wallet address format.
 * @param {string} address
 * @returns {boolean}
 */
export function isValidEvmAddress(address) {
  return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}
