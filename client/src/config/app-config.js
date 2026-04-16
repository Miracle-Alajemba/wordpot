export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const WALLET_STORAGE_KEY = "wordpot_connected_wallet";
export const ROOM_SESSION_STORAGE_KEY = "wordpot_room_session";
export const CELO_MAINNET_CHAIN_ID = 42220;

export const GAME_RULES = [
  "Words must be at least 3 letters long",
  "Use each letter only as many times as it appears",
  "Every claimed word scores only once",
  "Longer words earn bigger points",
  "90% of the pot is shared by score",
  "Practice mode is free while we build multiplayer",
];
