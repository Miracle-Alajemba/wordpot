/**
 * Memorable 4-character uppercase room code generator for custom lobbies.
 * Uses unambiguous characters (excludes O, 0, I, 1 to prevent reader confusion).
 */

const UNAMBIGUOUS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a random 4-character room code.
 * @returns {string} 4-character uppercase string
 */
export function generateRoomCode() {
  let result = "";
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    result += UNAMBIGUOUS_CHARS.charAt(randomIndex);
  }
  return result;
}

/**
 * Validate room code format.
 * @param {string} code
 * @returns {boolean}
 */
export function isValidRoomCode(code) {
  if (!code || typeof code !== "string") return false;
  return /^[A-Z0-9]{4}$/.test(code.trim().toUpperCase());
}
