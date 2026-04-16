export function shortenWalletAddress(value) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function shortenHash(value) {
  if (!value) return "--";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

export function getPlayerAlias(walletAddress, fallbackIndex = 1) {
  const short = shortenWalletAddress(walletAddress);
  if (!walletAddress) return `Player ${fallbackIndex}`;
  return `Player ${short.slice(2, 6).toUpperCase()}`;
}

function getAvatarSeed(walletAddress = "") {
  return walletAddress
    .slice(2, 8)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getAvatarStyle(walletAddress = "") {
  const hue = getAvatarSeed(walletAddress) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 78%), hsl(${(hue + 36) % 360} 48% 68%))`,
  };
}

export function formatEventTime(value) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRoomTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
