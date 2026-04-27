export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://wordpot-api.onrender.com/api";
export const REOWN_PROJECT_ID =
  import.meta.env.VITE_REOWN_PROJECT_ID || "cbfc2451e9f790961dec9b74d3545d51";
export const APP_URL =
  import.meta.env.VITE_APP_URL || "https://wordpot.vercel.app";

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
