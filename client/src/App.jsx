import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluatePracticeSubmission,
  getWordScore,
  normalizeWord,
} from "./game.js";

const ROUND_SECONDS = 60;
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const WALLET_STORAGE_KEY = "wordpot_connected_wallet";
const ROOM_SESSION_STORAGE_KEY = "wordpot_room_session";
const CELO_MAINNET_CHAIN_ID = 42220;


const GAME_RULES = [
  "Words must be at least 3 letters long",
  "Use each letter only as many times as it appears",
  "Every claimed word scores only once",
  "Longer words earn bigger points",
  "90% of the pot is shared by score",
  "Practice mode is free while we build multiplayer",
];

function ScoreBadge({ label, value }) {
  return (
    <div className="score-badge">
      <span>{label}</span>
      <strong className="live-score">{value}</strong>
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className="data-highlight">{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

function shortenWalletAddress(value) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

function parseChainId(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  try {
    return Number(BigInt(value));
  } catch {
    return Number(value) || null;
  }
}

function toHexChainId(chainId) {
  return `0x${Number(chainId).toString(16)}`;
}

function shortenHash(value) {
  if (!value) return "--";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function saveRoomSession(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readRoomSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.roomId || !parsed?.playerId || !parsed?.walletAddress) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearRoomSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
}

async function ensureCeloMainnet(provider, chainId = CELO_MAINNET_CHAIN_ID) {
  const targetChainId = toHexChainId(chainId);
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (String(currentChainId).toLowerCase() === targetChainId.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: targetChainId,
        chainName: "Celo Mainnet",
        nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
        rpcUrls: ["https://forno.celo.org"],
        blockExplorerUrls: ["https://celoscan.io"],
      }],
    });
  }
}

function getWalletProviderName(provider) {
  if (!provider) return "No wallet";
  if (provider.isMiniPay) return "MiniPay";
  if (provider.isMetaMask) return "MetaMask";
  return "Injected wallet";
}

function getNetworkLabel(chainId) {
  const normalized = parseChainId(chainId);
  if (!normalized) return "Unknown network";
  if (normalized === CELO_MAINNET_CHAIN_ID) return "Celo Mainnet";
  if (normalized === 11142220) return "Celo Sepolia";
  return `Chain ${normalized}`;
}

function getPlayerAlias(walletAddress, fallbackIndex = 1) {
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

function getAvatarStyle(walletAddress = "") {
  const hue = getAvatarSeed(walletAddress) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 55% 78%), hsl(${(hue + 36) % 360} 48% 68%))`,
  };
}

function getSyncStatusMeta(syncStatus) {
  if (syncStatus === "live") {
    return {
      label: "Live",
      className: "status-pill status-pill--live",
    };
  }

  if (syncStatus === "retrying") {
    return {
      label: "Reconnecting",
      className: "status-pill status-pill--warn",
    };
  }

  return {
    label: "Sync Idle",
    className: "status-pill status-pill--idle",
  };
}

function formatRoomTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatEventTime(value) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildWordFromSelection(sourceWord, selectedIndexes) {
  const letters = String(sourceWord || "").split("");
  return selectedIndexes.map((index) => letters[index] || "").join("").toLowerCase();
}

function TimerTone({ seconds }) {
  const safe = Math.max(0, Number(seconds || 0));
  const className =
    safe <= 10 ? "timer-pill timer-pill--late" : safe <= 25 ? "timer-pill timer-pill--warning" : "timer-pill";

  return (
    <div className={className}>
      <span>{formatRoomTimer(safe)}</span>
      <small>remaining</small>
    </div>
  );
}

function PlayerIdentity({ walletAddress, emphasis = false }) {
  return (
    <div className="player-identity">
      <span className={`player-avatar ${emphasis ? "player-avatar--large" : ""}`} style={getAvatarStyle(walletAddress)}>
        {walletAddress?.slice(2, 4).toUpperCase() || "WP"}
      </span>
      <div className="player-identity__copy">
        <strong>{getPlayerAlias(walletAddress)}</strong>
        <span>{shortenWalletAddress(walletAddress)}</span>
      </div>
    </div>
  );
}

function RoomPlayersStrip({ players = [], scoreboard = [], playerId }) {
  const scoreLookup = new Map(scoreboard.map((entry) => [entry.playerId, entry]));

  return (
    <div className="room-players-strip" aria-label="Players in room">
      {players.map((player, index) => {
        const scoreEntry = scoreLookup.get(player.id);
        const isCurrentPlayer = player.id === playerId;
        return (
          <article key={player.id} className={`room-player-card ${isCurrentPlayer ? "room-player-card--self" : ""}`}>
            <PlayerIdentity walletAddress={player.walletAddress} />
            <div className="room-player-card__meta">
              <span>{scoreEntry?.score || 0} pts</span>
              <small>{scoreEntry?.wordsFound || 0} words</small>
            </div>
            {isCurrentPlayer ? <span className="self-pill">You</span> : null}
            {index === 0 ? <span className="host-pill">Host</span> : null}
            {player.joinPaid ? <span className="host-pill">Paid</span> : null}
          </article>
        );
      })}
    </div>
  );
}

function ChatMessage({ entry, isOwnMessage }) {
  if (entry.type === "system") {
    return (
      <div className="system-message">
        <span className="system-message__icon">+</span>
        <div>
          <strong>[System]</strong> {entry.message}
        </div>
        <small>{formatEventTime(entry.createdAt)}</small>
      </div>
    );
  }

  const accepted = entry.status === "accepted";
  const rejectionLabel =
    entry.reason === "Already used"
      ? "Duplicate"
      : entry.reason === "Invalid word"
        ? "Not a valid word"
        : entry.reason || "Rejected";

  return (
    <article className={`chat-bubble ${isOwnMessage ? "chat-bubble--self" : ""} ${accepted ? "chat-bubble--accepted" : "chat-bubble--rejected"}`}>
      <PlayerIdentity walletAddress={entry.walletAddress} emphasis />
      <div className="chat-bubble__main">
        <span className={`chat-bubble__word ${accepted ? "" : "chat-bubble__word--muted"}`}>
          {entry.word || "(empty)"}
        </span>
        <div className="chat-bubble__meta">
          <span className={`chat-bubble__points ${accepted ? "" : "chat-bubble__points--muted"}`}>
            {accepted ? `+${entry.score} pts` : entry.reason === "Already used" ? "Already used" : "0 pts"}
          </span>
          <span className={`validation-badge ${accepted ? "validation-badge--ok" : "validation-badge--bad"}`}>
            {accepted ? "✓" : "✕"}
          </span>
        </div>
      </div>
      {!accepted ? <p className="chat-bubble__reason">{rejectionLabel}</p> : null}
      <small className="chat-bubble__time">{formatEventTime(entry.createdAt)}</small>
    </article>
  );
}

function Icon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "1.8",
    viewBox: "0 0 24 24",
  };

  const paths = {
    home: (
      <>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.5V20h11V9.5" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M6 19c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" />
      </>
    ),
    leaderboard: (
      <>
        <path d="M6 19V10" />
        <path d="M12 19V6" />
        <path d="M18 19v-8" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="m19 12 1.5-.7-.8-2-1.7.1a6.8 6.8 0 0 0-1.1-1.2l.2-1.7-2-1-1 1.4a6.5 6.5 0 0 0-1.6 0l-1-1.4-2 1 .2 1.7c-.4.3-.8.7-1.1 1.2l-1.7-.1-.8 2L5 12l-.7 1.4.8 2 1.7-.1c.3.5.7.9 1.1 1.2l-.2 1.7 2 1 1-1.4c.5.1 1.1.1 1.6 0l1 1.4 2-1-.2-1.7c.4-.3.8-.7 1.1-1.2l1.7.1.8-2z" />
      </>
    ),
    wallet: (
      <>
        <path d="M4.5 8.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z" />
        <path d="M6 8V7a2 2 0 0 1 2-2h9" />
        <circle cx="16.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
      </>
    ),
    chat: (
      <>
        <path d="M5 18.5 4 21l3.1-1.8H18a2 2 0 0 0 2-2V7.8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8.4a2 2 0 0 0 1 1.7Z" />
      </>
    ),
  };

  return <svg aria-hidden="true" {...common}>{paths[name] || paths.home}</svg>;
}

function AppBottomNav({ screen, onNavigate, walletAddress, onWalletAction }) {
  const items = [
    { id: "home", label: "Home", icon: "home" },
    { id: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { id: "profile", label: "Profile", icon: "profile" },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item ${screen === item.id ? "bottom-nav__item--active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}

      <button type="button" className="bottom-nav__item" onClick={onWalletAction}>
        <Icon name="wallet" />
        <span>{walletAddress ? shortenWalletAddress(walletAddress) : "Wallet"}</span>
      </button>
    </nav>
  );
}

function LeaderboardScreen({ room, onQuickMatch, onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/leaderboard`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load leaderboard.");
        }

        if (!active) return;
        setEntries(data.entries || []);
      } catch (leaderboardError) {
        if (!active) return;

        if (room?.scoreboard?.length) {
          setEntries(
            room.scoreboard.map((entry, index) => ({
              rank: index + 1,
              walletAddress: entry.walletAddress,
              score: entry.score,
              wordsFound: entry.wordsFound,
              gamesPlayed: 1,
              wins: index === 0 && entry.score > 0 ? 1 : 0,
            })),
          );
          setError("Showing the current room leaderboard while the server feed catches up.");
        } else {
          setEntries([]);
          setError(leaderboardError.message || "Unable to load leaderboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();
    return () => {
      active = false;
    };
  }, [room]);

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>Back</button>
          <p className="eyebrow">Community Leaderboard</p>
        </div>

        <section className="profile-shell">
          <article className="panel profile-panel profile-panel--hero">
            <div>
              <h1 className="profile-title">Leaderboard</h1>
              <p className="profile-subtitle">See who is shaping the cleanest runs and sharpest word streaks.</p>
            </div>
            <button type="button" onClick={onQuickMatch}>Join Game</button>
          </article>

          <article className="panel profile-panel">
            <div className="room-panel__header">
              <div>
                <h3>Top Players</h3>
                <p>Live ranking from current and recent arena sessions.</p>
              </div>
            </div>
            {error ? <div className="notice-strip notice-strip--neutral">{error}</div> : null}
            {loading ? (
              <div className="empty-card">Loading leaderboard...</div>
            ) : entries.length ? (
              <div className="leaderboard-table">
                {entries.map((entry, index) => (
                  <div key={`${entry.walletAddress}-${entry.rank || index}`} className={`leaderboard-table__row ${index === 0 ? "leaderboard-table__row--top" : ""}`}>
                    <div className="leaderboard-table__rank">#{entry.rank || index + 1}</div>
                    <PlayerIdentity walletAddress={entry.walletAddress} emphasis />
                    <div className="leaderboard-table__stats">
                      <strong>{entry.score} pts</strong>
                      <span>{entry.wordsFound} words • {entry.wins || 0} wins</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-card">No player results yet. Finish a live room and this board will update.</div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

function ProfileScreen({ walletAddress, onConnectWallet, onBack }) {
  const connected = isWalletAddress(walletAddress);
  const alias = connected ? getPlayerAlias(walletAddress) : "Guest Player";
  const achievements = ["First Win", "Clean Streak", "Sharp Eye", "Fast Fingers", "Word Artist", "Night Owl"];

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>Back</button>
          <p className="eyebrow">Profile</p>
        </div>

        <section className="profile-shell">
          <article className="panel profile-panel profile-panel--hero">
            <div className="profile-head">
              <span className="profile-avatar" style={getAvatarStyle(walletAddress || "guest-wallet")}>
                {(connected ? walletAddress.slice(2, 4) : "WP").toUpperCase()}
              </span>
              <div>
                <h1 className="profile-title">{alias}</h1>
                <p className="profile-subtitle">{connected ? shortenWalletAddress(walletAddress) : "Connect a wallet to personalise your profile."}</p>
                <span className="rank-badge">Word Artist • Level 7</span>
              </div>
            </div>
            {!connected ? <button type="button" onClick={onConnectWallet}>Connect Wallet</button> : null}
          </article>

          <article className="panel profile-panel">
            <h3>Stats</h3>
            <div className="profile-stats-grid">
              <MetricCard label="Wins" value="18" hint="Lifetime arena wins" />
              <MetricCard label="Streak" value="4" hint="Current win streak" />
              <MetricCard label="Level" value="7" hint="Progression level" />
              <MetricCard label="Earnings" value="$24.60" hint="Total rewards earned" />
            </div>
          </article>

          <article className="panel profile-panel">
            <div className="room-panel__header">
              <div>
                <h3>Achievements</h3>
                <p>Soft milestones that unlock as you keep playing.</p>
              </div>
            </div>
            <div className="achievement-grid">
              {achievements.map((item, index) => (
                <div key={item} className={`achievement-chip ${index > 3 ? "achievement-chip--locked" : ""}`}>
                  <span>{index > 3 ? "◌" : "✦"}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function SettingsScreen({ settings, onToggle, onBack }) {
  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>Back</button>
          <p className="eyebrow">Settings</p>
        </div>

        <section className="profile-shell">
          <article className="panel profile-panel">
            <h3>Sound & Haptics</h3>
            <div className="settings-list">
              <button type="button" className="settings-row" onClick={() => onToggle("sound")}>
                <span>Sound effects</span>
                <strong>{settings.sound ? "On" : "Off"}</strong>
              </button>
              <button type="button" className="settings-row" onClick={() => onToggle("haptics")}>
                <span>Haptic feedback</span>
                <strong>{settings.haptics ? "On" : "Off"}</strong>
              </button>
            </div>
          </article>

          <article className="panel profile-panel">
            <h3>Display</h3>
            <div className="settings-list">
              <button type="button" className="settings-row" onClick={() => onToggle("highContrast")}>
                <span>High contrast mode</span>
                <strong>{settings.highContrast ? "Enabled" : "Disabled"}</strong>
              </button>
              <button type="button" className="settings-row" onClick={() => onToggle("largeText")}>
                <span>Larger text</span>
                <strong>{settings.largeText ? "Enabled" : "Disabled"}</strong>
              </button>
            </div>
          </article>

          <article className="panel profile-panel">
            <h3>Privacy</h3>
            <div className="settings-list">
              <button type="button" className="settings-row" onClick={() => onToggle("showEarnings")}>
                <span>Show earnings publicly</span>
                <strong>{settings.showEarnings ? "Shown" : "Hidden"}</strong>
              </button>
              <button type="button" className="settings-row" onClick={() => onToggle("showRank")}>
                <span>Show rank publicly</span>
                <strong>{settings.showRank ? "Shown" : "Hidden"}</strong>
              </button>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function HomeScreen({
  onStartPractice,
  onQuickMatch,
  onOpenLeaderboard,
  onOpenProfile,
  walletAddress,
  walletStatus,
  walletReady,
  walletProviderName,
  walletNetworkLabel,
  onConnectWallet,
  onDisconnectWallet,
  walletHint,
  roomError,
}) {
  const joinLabel = !walletAddress
    ? "Connect Wallet to Join"
    : walletReady
      ? "Join Game"
      : "Switch to Celo to Join";

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MiniPay Word Game</p>
          <h1>WordPot</h1>
          <p className="lede">
            A fast multiplayer word challenge where players build words from a
            shared prompt, race the clock, and earn a share of the pot based on
            how well they perform. Multiplayer rooms use wallet identity so
            payouts can go straight back to players.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={onQuickMatch}>
              {joinLabel}
            </button>
            <button type="button" className="button-secondary" onClick={onStartPractice}>
              Practice Arena
            </button>
            <button type="button" className="button-secondary button-accent-blue" onClick={onOpenLeaderboard}>
              Leaderboard
            </button>
          </div>

          {roomError ? (
            <div className="notice-strip notice-strip--error">
              {roomError}
            </div>
          ) : null}

          <div className="wallet-panel">
            <div className="wallet-panel__copy">
              <label>Wallet sign in</label>
              <strong>
                {walletAddress ? shortenWalletAddress(walletAddress) : "No wallet connected"}
              </strong>
              <div className="wallet-state-strip">
                <span className="wallet-chip">{walletProviderName}</span>
                <span className={`wallet-chip ${walletReady ? "wallet-chip--ok" : "wallet-chip--soft"}`}>
                  {walletNetworkLabel}
                </span>
                <span className={`wallet-chip ${walletReady ? "wallet-chip--ok" : "wallet-chip--warn"}`}>
                  {walletReady ? "Ready to play" : walletAddress ? "Needs setup" : "Not connected"}
                </span>
              </div>
              <p className="field-hint">
                {walletHint ||
                  "Connect your MiniPay-compatible wallet so rooms use your real onchain identity."}
              </p>
            </div>
            <div className="wallet-panel__actions">
              <button type="button" onClick={onConnectWallet}>
                {walletAddress ? (walletReady ? "Reconnect Wallet" : "Switch to Celo") : "Connect Wallet"}
              </button>
              {walletAddress ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onDisconnectWallet}
                >
                  Disconnect
                </button>
              ) : null}
            </div>
            {walletStatus ? (
              <div className="wallet-status">
                {walletStatus}
              </div>
            ) : null}
          </div>

          <div className="feature-strip">
            <div className="feature-pill">60 second rounds</div>
            <div className="feature-pill">0.1 cUSD stake</div>
            <div className="feature-pill">90% split by score</div>
            <div className="feature-pill">Live room chat</div>
            <div className="feature-pill">Free practice arena</div>
          </div>
        </div>

        <div className="hero-card">
          <p className="hero-card__label">Sample round</p>
          <h2>BLOCKCHAIN</h2>
          <div className="letter-rack">
            {"BLOCKCHAIN".split("").map((letter, index) => (
              <span key={`${letter}-${index}`} className="letter-tile">
                {letter}
              </span>
            ))}
          </div>
          <div className="hero-card__grid">
            <span>Timer: 60s</span>
            <span>Stake: 1.0 cUSD</span>
            <span>Players: 2-5</span>
            <span>Pool: 90% shared by score</span>
          </div>
          <div className="hero-card__actions">
            <button type="button" className="button-secondary" onClick={onOpenProfile}>
              View Profile
            </button>
            {!walletAddress ? (
              <button type="button" onClick={onConnectWallet}>
                Connect Wallet
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <h3>Core Loop</h3>
          <ol>
            <li>Join a room</li>
            <li>Get a shared source word</li>
            <li>Submit valid words before time ends</li>


            <li>Score points from word length</li>
            <li>Reward pool is shared by score</li>
          </ol>
        </article>

        <article className="panel">
          <h3>Game Rules</h3>
          <ul>
            {GAME_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="panel panel-wide">
          <h3>Prize Logic</h3>
          <p>
            Every room starts with a small cUSD stake from each player. WordPot
            keeps a 10% treasury fee, and the remaining 90% is shared using a
            simple formula: your score divided by total room score, multiplied by
            the reward pool.
          </p>
        </article>

        <article className="panel panel-wide">
          <div className="featured-stats">
            <div className="featured-stats__item">
              <span>Prize Pool</span>
              <strong>$248</strong>
            </div>
            <div className="featured-stats__item">
              <span>Players Online</span>
              <strong>124</strong>
            </div>
            <div className="featured-stats__item">
              <span>Connected Wallet</span>
              <strong>{walletAddress ? shortenWalletAddress(walletAddress) : "Not connected"}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function LobbyScreen({
  room,
  playerId,
  statusMessage,
  error,
  syncStatus,
  onRefresh,
  onStart,
  onPayEntryFee,
  paymentBusy,
  onBack,
}) {
  const syncMeta = getSyncStatusMeta(syncStatus);
  const isHost = room?.hostPlayerId === playerId;
  const paidPlayersCount = room?.onchain?.paidPlayersCount || 0;
  const totalPlayers = room?.players?.length || 0;
  const allPaid = totalPlayers > 0 && paidPlayersCount === totalPlayers;
  const canStart =
    room?.status === "waiting" && room?.players?.length >= 2 && isHost && allPaid;
  const joinPayment = room?.onchain?.joinPaymentDisplay || "0.001 CELO";
  const hasPaid = (room?.onchain?.joinTransactions || []).some((entry) => entry.playerId === playerId);
  const unpaidPlayers = (room?.players || []).filter((entry) => !entry.joinPaid);
  const unpaidCount = unpaidPlayers.length;
  const joinedCount = room?.players?.length || 0;
  const lobbyTitle = hasPaid
    ? allPaid
      ? isHost
        ? "Everyone is ready. You can start the round now."
        : "Everyone is ready. Waiting for the host to begin."
      : "Your entry is confirmed. Waiting for the rest of the room."
    : "Complete your entry to confirm your seat in this round.";

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <p className="eyebrow">Quick Match Lobby</p>
        </div>

        <div className="room-topbar">
          <div>
            <p className="play-label">WordPot Arena</p>
            <h1>{room?.id || "LOADING"}</h1>
          </div>
          <div className="room-topbar__stats">
            <span>{room?.entryFee || "0.1 cUSD"}</span>
            <span>{room?.rewardPool || "--"}</span>
            <span>{room?.players?.length || 0}/{room?.maxPlayers || 5} players</span>
            <span className={syncMeta.className}>{syncMeta.label}</span>
          </div>
        </div>

        {statusMessage ? (
          <div className="notice-strip notice-strip--success">{statusMessage}</div>
        ) : null}
        {error ? <div className="notice-strip notice-strip--error">{error}</div> : null}

        <section className="chat-room-layout">
          <article className="panel room-panel">
            <div className="room-panel__header">
              <div>
                <h3>Match Lobby</h3>
                <p>{lobbyTitle}</p>
              </div>
              <TimerTone seconds={0} />
            </div>

            <div className={`lobby-readiness-card ${allPaid ? "lobby-readiness-card--ready" : ""}`}>
              <div>
                <span className="lobby-readiness-card__label">Round status</span>
                <strong>{allPaid ? "Ready to start" : "Waiting for player confirmations"}</strong>
              </div>
              <div className="lobby-readiness-card__progress">
                <div className="lobby-readiness-card__count">{paidPlayersCount}/{totalPlayers || 0}</div>
                <small>{allPaid ? "All joined players have confirmed entry." : "Joined players who have completed entry payment."}</small>
              </div>
            </div>

            <div className="lobby-summary-grid">
              <div className="lobby-stat-card">
                <span>Entry Fee</span>
                <strong>{room?.entryFee || "0.1 cUSD"}</strong>
              </div>
              <div className="lobby-stat-card">
                <span>Prize Pool</span>
                <strong>{room?.rewardPool || "--"}</strong>
              </div>
              <div className="lobby-stat-card">
                <span>Entry Payment</span>
                <strong>{joinPayment}</strong>
              </div>
              <div className="lobby-stat-card">
                <span>Confirmed</span>
                <strong>{paidPlayersCount}/{totalPlayers || room?.maxPlayers || 5}</strong>
              </div>
              <div className="lobby-stat-card">
                <span>Players in Room</span>
                <strong>{room?.players?.length || 0}/{room?.maxPlayers || 5}</strong>
              </div>
            </div>

            <div className="notice-strip notice-strip--neutral">
              {hasPaid
                ? `Entry confirmed. Payment reference: ${shortenHash((room?.onchain?.joinTransactions || []).find((entry) => entry.playerId === playerId)?.txHash)}`
                : `Pay ${joinPayment} to confirm your seat. The round starts once every joined player has paid.`}
            </div>

            {!allPaid ? (
              <div className="notice-strip notice-strip--neutral">
                {unpaidCount
                  ? `Waiting for ${unpaidCount} player${unpaidCount > 1 ? "s" : ""} to confirm entry: ${unpaidPlayers.map((entry) => getPlayerAlias(entry.walletAddress)).join(", ")}.`
                  : joinedCount < (room?.minPlayers || 2)
                    ? `At least ${room?.minPlayers || 2} players are needed before the round can begin.`
                    : "All joined players must confirm entry before the host can start the round."}
              </div>
            ) : null}

            <RoomPlayersStrip players={room?.players} scoreboard={room?.scoreboard} playerId={playerId} />

            <div className="lobby-actions lobby-actions--row">
              <button type="button" onClick={onRefresh}>
                Refresh Lobby
              </button>
              <button
                type="button"
                className={hasPaid ? "button-secondary" : ""}
                onClick={onPayEntryFee}
                disabled={paymentBusy || hasPaid}
              >
                {paymentBusy ? "Processing..." : hasPaid ? "Entry Paid" : `Pay ${joinPayment}`}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={onStart}
                disabled={!canStart}
              >
                {isHost ? (allPaid ? "Start Arena" : "Waiting for payments") : "Waiting for host"}
              </button>
            </div>
          </article>

          <article className="panel room-panel">
            <div className="room-panel__header">
              <div>
                <h3>Room Feed</h3>
                <p>Entry confirmations and room activity appear here in real time.</p>
              </div>
            </div>
            <div className="chat-feed chat-feed--lobby">
              {(room?.feed || []).length ? (
                (room.feed || []).map((entry, index) => (
                  <ChatMessage
                    key={`${entry.createdAt}-${index}`}
                    entry={entry}
                    isOwnMessage={entry.playerId === playerId}
                  />
                ))
              ) : (
                <div className="empty-card">Waiting for players...</div>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function MatchRoomScreen({
  room,
  playerId,
  roomMessage,
  roomError,
  syncStatus,
  onRefresh,
  onSubmitWord,
  onClaimReward,
  claimBusy,
  onBackHome,
}) {
  const syncMeta = getSyncStatusMeta(syncStatus);
  const [draftWord, setDraftWord] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [pausedAutoScroll, setPausedAutoScroll] = useState(false);
  const chatFeedRef = useRef(null);
  const isFinished = room?.status === "finished";
  const myScore =
    room?.scoreboard?.find((entry) => entry.playerId === playerId)?.score || 0;
  const timeLeft = room?.timeLeftSeconds ?? 0;
  const feed = room?.feed || [];
  const myPlayer = room?.players?.find((entry) => entry.id === playerId);
  const myJoinTx = (room?.onchain?.joinTransactions || []).find(
    (entry) => entry.playerId === playerId,
  );
  const myClaimTx = (room?.onchain?.claimTransactions || []).find(
    (entry) => entry.playerId === playerId,
  );
  const myPayout = (room?.payouts || []).find(
    (entry) => entry.walletAddress === myPlayer?.walletAddress,
  );
  const claimRecorded = myPlayer?.claimRecorded;
  const claimEnabled = room?.onchain?.payoutMode === "contract_claim" && Number(myPayout?.amount || 0) > 0 && !claimRecorded;
  const payoutAmount = Number(myPayout?.amount || 0);
  const claimStatusTitle = claimRecorded
    ? "Claim recorded"
    : room?.onchain?.payoutMode === "contract_claim"
      ? payoutAmount > 0
        ? "Ready to claim"
        : "No reward to claim"
      : "Claim preview only";
  const claimStatusCopy = claimRecorded
    ? `Your latest claim reference is ${shortenHash(myClaimTx?.txHash)}.`
    : room?.onchain?.payoutMode === "contract_claim"
      ? payoutAmount > 0
        ? "This room is contract-ready. Once claim wiring is complete, this button will send your onchain reward claim."
        : "You finished the room, but there is no positive payout available for this wallet."
      : "The beta flow already records onchain joins. Contract reward claims are the next deployment step.";
  const sourceLetters = String(room?.sourceWord || "").split("");
  const selectedWord = draftWord;

  useEffect(() => {
    setDraftWord("");
    setSelectedIndexes([]);
  }, [room?.sourceWord, room?.id]);

  useEffect(() => {
    const node = chatFeedRef.current;
    if (!node || pausedAutoScroll) return;

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [feed, pausedAutoScroll]);

  function handleFeedScroll() {
    const node = chatFeedRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    setPausedAutoScroll(!nearBottom);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedWord.trim()) return;
    onSubmitWord(selectedWord);
    setDraftWord("");
    setSelectedIndexes([]);
  }

  function handleToggleTile(index) {
    setSelectedIndexes((current) => {
      const nextIndexes = current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index];
      setDraftWord(buildWordFromSelection(room?.sourceWord, nextIndexes));
      return nextIndexes;
    });
  }

  function clearSelection() {
    setDraftWord("");
    setSelectedIndexes([]);
  }

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBackHome}>
            Back
          </button>
          <p className="eyebrow">Live Room</p>
        </div>

        <div className="room-topbar">
          <div>
            <p className="play-label">WordPot Arena</p>
            <h1>{room?.id || "LIVE"}</h1>
          </div>
          <div className="room-topbar__stats">
            <span>{room?.players?.length || 0}/{room?.maxPlayers || 5} players online</span>
            <span>{room?.rewardPool || "--"}</span>
            <span>{room?.entryFee || "0.1 cUSD"}</span>
            <span className={syncMeta.className}>{syncMeta.label}</span>
          </div>
        </div>

        <div className="room-live-header">
          <TimerTone seconds={timeLeft} />
          <div className="room-live-header__meta">
            <strong>Source Word: {room?.sourceWord || "READY"}</strong>
            <span>{myPlayer ? `${getPlayerAlias(myPlayer.walletAddress)} • ${shortenWalletAddress(myPlayer.walletAddress)}` : "Connected player"}</span>
          </div>
          <div className="room-live-header__score">
            <small>Your score</small>
            <strong className="live-score">{myScore} pts</strong>
          </div>
        </div>

        {roomMessage ? (
          <div className="notice-strip notice-strip--success">{roomMessage}</div>
        ) : null}
        {roomError ? <div className="notice-strip notice-strip--error">{roomError}</div> : null}

        {!isFinished ? (
          <>
            <div className="compact-board">
              <div className="compact-board__top">
                <span>Source Word</span>
                <strong>{room?.sourceWord || "READY"}</strong>
              </div>
              <div className="letter-rack letter-rack--play letter-rack--compact">
                {sourceLetters.map((letter, index) => (
                  <button
                    key={`${letter}-${index}`}
                    type="button"
                    className={`letter-tile letter-tile--compact letter-tile--interactive ${selectedIndexes.includes(index) ? "letter-tile--selected" : ""}`}
                    onClick={() => handleToggleTile(index)}
                    aria-label={`Select letter ${letter}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <div className="word-preview">
                {selectedWord ? selectedWord.toUpperCase().split("").join(" - ") : "S-E-A"}
              </div>
            </div>

            <RoomPlayersStrip players={room?.players} scoreboard={room?.scoreboard} playerId={playerId} />

            <section className="chat-room-layout">
              <article className="panel panel-chat panel-chat--primary">
                <div className="room-panel__header">
                  <div>
                    <h3>Live Chat Feed</h3>
                    <p>Every word claim lands here for the whole room to see.</p>
                  </div>
                  {selectedIndexes.length ? <span className="typing-indicator">You are forming a word...</span> : null}
                </div>

                <div
                  ref={chatFeedRef}
                  className="chat-feed chat-feed--live"
                  onScroll={handleFeedScroll}
                >
                  {feed.length ? (
                    feed.map((entry, index) => (
                      <ChatMessage
                        key={`${entry.createdAt}-${index}`}
                        entry={entry}
                        isOwnMessage={entry.playerId === playerId}
                      />
                    ))
                  ) : (
                    <div className="empty-card">
                      Waiting for the first word claim...
                    </div>
                  )}
                </div>
              </article>

              <article className="panel panel-scoreboard panel-scoreboard--live">
                <div className="room-panel__header">
                  <div>
                    <h3>Leaderboard</h3>
                    <p>Scores shift live as valid words land.</p>
                  </div>
                </div>
                <div className="player-list player-list--leaderboard">
                  {(room?.scoreboard || []).map((entry) => (
                    <div key={entry.playerId} className={`player-row ${entry.playerId === playerId ? "player-row--self" : ""}`}>
                      <div>
                        <strong>{getPlayerAlias(entry.walletAddress)}</strong>
                        <p>{shortenWalletAddress(entry.walletAddress)}</p>
                      </div>
                      <div className="leaderboard-points">
                        <span className="live-score">{entry.score} pts</span>
                        <small>{entry.wordsFound} words</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <form className="submit-panel submit-panel--sticky" onSubmit={handleSubmit}>
              <input
                type="text"
                value={selectedWord}
                onChange={(event) => {
                  setDraftWord(event.target.value);
                  setSelectedIndexes([]);
                }}
                placeholder="Tap letters or type your word"
                autoComplete="off"
                spellCheck="false"
                disabled={timeLeft === 0}
              />
              <button type="button" className="button-secondary" onClick={clearSelection}>
                Clear
              </button>
              <button type="submit" disabled={timeLeft === 0 || !selectedWord}>
                Submit Word
              </button>
            </form>
          </>
        ) : null}

        <div className="hero-actions">
          <button type="button" className="button-secondary" onClick={onRefresh}>
            Refresh Room
          </button>
        </div>

        {isFinished ? (
          <section className="chat-room-layout">
            <article className="panel panel-chat panel-chat--primary">
              <div className="room-panel__header">
                <div>
                  <h3>Game History</h3>
                  <p>Every word from the room stays visible after the round ends.</p>
                </div>
              </div>
              <div className="chat-feed chat-feed--live">
                {feed.map((entry, index) => (
                  <ChatMessage
                    key={`${entry.createdAt}-${index}`}
                    entry={entry}
                    isOwnMessage={entry.playerId === playerId}
                  />
                ))}
              </div>
            </article>

            <article className="panel panel-scoreboard panel-scoreboard--live">
              <div className="room-panel__header">
                <div>
                  <h3>Game Over</h3>
                  <p>Final ranking and payout split for this arena.</p>
                </div>
              </div>

              <div className="claim-card">
                <div className="claim-card__top">
                  <div>
                    <span className="claim-card__label">Your reward</span>
                    <strong className="claim-card__amount">{payoutAmount.toFixed(4)} cUSD</strong>
                  </div>
                  <span className={`claim-card__status ${claimRecorded ? "claim-card__status--success" : payoutAmount > 0 ? "claim-card__status--ready" : ""}`}>
                    {claimStatusTitle}
                  </span>
                </div>
                <p className="claim-card__copy">{claimStatusCopy}</p>
                <div className="claim-card__meta">
                  <div className="claim-meta-chip">
                    <span>Join Tx</span>
                    <strong>{myJoinTx?.txHash ? shortenHash(myJoinTx.txHash) : "Pending"}</strong>
                  </div>
                  <div className="claim-meta-chip">
                    <span>Claim Tx</span>
                    <strong>{myClaimTx?.txHash ? shortenHash(myClaimTx.txHash) : "Not claimed"}</strong>
                  </div>
                  <div className="claim-meta-chip">
                    <span>Payout Mode</span>
                    <strong>{room?.onchain?.payoutMode === "contract_claim" ? "Contract" : "Beta"}</strong>
                  </div>
                </div>
                <div className="hero-actions">
                  <button
                    type="button"
                    onClick={onClaimReward}
                    disabled={!claimEnabled || claimBusy}
                  >
                    {claimBusy ? "Claiming..." : claimRecorded ? "Claim Recorded" : payoutAmount > 0 ? "Claim Reward" : "No Reward"}
                  </button>
                  <button type="button" className="button-secondary" onClick={onRefresh}>
                    Refresh Results
                  </button>
                </div>
              </div>

              <div className="player-list">
                {(room?.scoreboard || []).map((entry) => (
                  <div key={entry.playerId} className={`player-row ${entry.playerId === playerId ? "player-row--self" : ""}`}>
                    <div>
                      <strong>{getPlayerAlias(entry.walletAddress)}</strong>
                      <p>{shortenWalletAddress(entry.walletAddress)} • {entry.wordsFound} words</p>
                    </div>
                    <span className="self-pill">{entry.score} pts</span>
                  </div>
                ))}
              </div>

              <div className="results-subtitle">Reward Distribution</div>
              <div className="player-list">
                {(room?.payouts || []).map((entry) => (
                  <div key={entry.walletAddress} className="player-row">
                    <div>
                      <strong>{getPlayerAlias(entry.walletAddress)}</strong>
                      <p>{shortenWalletAddress(entry.walletAddress)}</p>
                    </div>
                    <span className="self-pill">{entry.amount} cUSD</span>
                  </div>
                ))}
              </div>

              <div className="notice-strip notice-strip--neutral">
                {room?.onchain?.payoutMode === "contract_claim"
                  ? "Contract payout mode is configured. Claim from here once the contract room wiring is connected."
                  : "Beta mode: join payments are onchain now, while reward claim stays in preview until contract payout is deployed."}
              </div>

              {(room?.onchain?.joinTransactions?.length || room?.onchain?.claimTransactions?.length) ? (
                <>
                  <div className="results-subtitle">Onchain Activity</div>
                  <div className="tx-list">
                    {(room?.onchain?.joinTransactions || []).map((entry) => (
                      <div key={entry.txHash} className="tx-row">
                        <div>
                          <strong>{getPlayerAlias(entry.walletAddress)}</strong>
                          <p>Join payment • {entry.amount}</p>
                        </div>
                        <span>{shortenHash(entry.txHash)}</span>
                      </div>
                    ))}
                    {(room?.onchain?.claimTransactions || []).map((entry) => (
                      <div key={entry.txHash} className="tx-row">
                        <div>
                          <strong>{getPlayerAlias(entry.walletAddress)}</strong>
                          <p>Reward claim • {entry.amount || "tracked"}</p>
                        </div>
                        <span>{shortenHash(entry.txHash)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </article>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function PracticeResults({ score, wordsFound, onReplay, onExit }) {
  return (
    <div className="results-sheet">
      <p className="eyebrow">Practice Complete</p>
      <h2>{score} pts</h2>
      <p>
        You claimed <strong>{wordsFound.length}</strong>{" "}
        {wordsFound.length === 1 ? "word" : "words"} this round.
      </p>

      <div className="word-grid">
        {wordsFound.length ? (
          wordsFound.map((entry) => (
            <div key={entry.word} className="word-chip">
              <strong>{entry.word}</strong>
              <span>+{entry.score}</span>
            </div>
          ))
        ) : (
          <div className="empty-card">
            No words found this round. Try again and go for quicker submissions.
          </div>
        )}
      </div>

      <div className="hero-actions">
        <button type="button" onClick={onReplay}>
          Play Again
        </button>
        <button type="button" className="button-secondary" onClick={onExit}>
          Back Home
        </button>
      </div>
    </div>
  );
}

function PracticeScreen({ onExit }) {
  const [roundSeed, setRoundSeed] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [draftWord, setDraftWord] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Build as many valid words as you can.");
  const [feedbackTone, setFeedbackTone] = useState("neutral");
  const [claimedWords, setClaimedWords] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [bestWord, setBestWord] = useState("");
  const [streak, setStreak] = useState(0);
  const [loadingRound, setLoadingRound] = useState(true);
  const sourceLetters = String(roundSeed?.sourceWord || "").split("");
  const selectedWord = draftWord;

  async function loadPracticeRound(nextFeedback = "New round loaded. Go fast and go clean.") {
    setLoadingRound(true);
    setFeedback("Loading a fresh round...");
    setFeedbackTone("neutral");

    try {
      const response = await fetch(`${API_BASE_URL}/rounds/practice`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load a practice round.");
      }
      setRoundSeed(data.round);
      setTimeLeft(ROUND_SECONDS);
      setDraftWord("");
      setSelectedIndexes([]);
      setScore(0);
      setClaimedWords([]);
      setIsFinished(false);
      setBestWord("");
      setStreak(0);
      setFeedback(nextFeedback);
      setFeedbackTone("neutral");
    } catch (error) {
      setFeedback(error.message || "Unable to load practice round.");
      setFeedbackTone("error");
    } finally {
      setLoadingRound(false);
    }
  }

  useEffect(() => {
    loadPracticeRound("Build as many valid words as you can.");
  }, []);

  useEffect(() => {
    if (isFinished || !roundSeed) return undefined;

    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setIsFinished(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isFinished, roundSeed?.sourceWord]);

  const claimedSet = useMemo(
    () => new Set(claimedWords.map((entry) => entry.word)),
    [claimedWords],
  );
  const progress = ((ROUND_SECONDS - timeLeft) / ROUND_SECONDS) * 100;
  const totalValidWords = roundSeed?.validWords?.length || 0;
  const dictionaryProgress = totalValidWords
    ? Math.round((claimedWords.length / totalValidWords) * 100)
    : 0;
  const longestWord = useMemo(() => {
    return claimedWords.reduce((current, entry) => {
      if (!current) return entry.word;
      return entry.word.length > current.length ? entry.word : current;
    }, "");
  }, [claimedWords]);

  function resetRound() {
    loadPracticeRound("New round. Go fast and go clean.");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isFinished || !roundSeed) {
      return;
    }

    const normalized = normalizeWord(selectedWord);
    setDraftWord("");
    setSelectedIndexes([]);
    const evaluation = evaluatePracticeSubmission({
      input: normalized,
      sourceWord: roundSeed.sourceWord,
      validWords: roundSeed.validWords,
      claimedWords: claimedSet,
    });

    if (!evaluation.ok) {
      setFeedback(evaluation.message);
      setFeedbackTone("error");
      setStreak(0);
      return;
    }

    const points = evaluation.score ?? getWordScore(evaluation.word);

    setClaimedWords((current) => [
      ...current,
      { word: evaluation.word, score: points },
    ]);
    setScore((current) => current + points);
    setFeedback(evaluation.message);
    setFeedbackTone("success");
    setStreak((current) => current + 1);

    if (!bestWord || evaluation.word.length > bestWord.length) {
      setBestWord(evaluation.word);
    }
  }

  function handleToggleTile(index) {
    setSelectedIndexes((current) => {
      const nextIndexes = current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index];
      setDraftWord(buildWordFromSelection(roundSeed?.sourceWord, nextIndexes));
      return nextIndexes;
    });
  }

  function clearSelection() {
    setDraftWord("");
    setSelectedIndexes([]);
  }

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onExit}>
            Back
          </button>
          <p className="eyebrow">Practice Mode</p>
        </div>

        <div className="play-hero">
          <div>
            <p className="play-label">Source word</p>
            <h1>{roundSeed?.sourceWord || "LOADING"}</h1>
            <p className="lede">
              Make real words from these letters before the timer runs out.
            </p>
            <div className="letter-rack letter-rack--play">
              {sourceLetters.map((letter, index) => (
                <button
                  key={`${letter}-${index}`}
                  type="button"
                  className={`letter-tile letter-tile--play letter-tile--interactive ${selectedIndexes.includes(index) ? "letter-tile--selected" : ""}`}
                  onClick={() => handleToggleTile(index)}
                  aria-label={`Select letter ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="word-preview word-preview--practice">
              {selectedWord ? selectedWord.toUpperCase().split("").join(" - ") : "Tap letters to form a word"}
            </div>
          </div>

          <div className="score-row">
            <ScoreBadge label="Time left" value={`${timeLeft}s`} />
            <ScoreBadge label="Score" value={score} />
            <ScoreBadge label="Claimed" value={claimedWords.length} />
          </div>
        </div>

        <div className="progress-shell">
          <div className="progress-labels">
            <span>Round pressure</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {loadingRound ? (
          <div className="results-sheet">
            <p className="eyebrow">Loading Round</p>
            <h2>...</h2>
            <p>Pulling a fresh source word from the backend.</p>
          </div>
        ) : isFinished ? (
          <PracticeResults
            score={score}
            wordsFound={claimedWords}
            onReplay={resetRound}
            onExit={onExit}
          />
        ) : (
          <>
            <form className="submit-panel" onSubmit={handleSubmit}>
              <input
                type="text"
                value={selectedWord}
                onChange={(event) => {
                  setDraftWord(event.target.value);
                  setSelectedIndexes([]);
                }}
                placeholder="Tap letters or type your word"
                autoComplete="off"
                spellCheck="false"
              />
              <button type="button" className="button-secondary" onClick={clearSelection}>
                Clear
              </button>
              <button type="submit" disabled={!selectedWord}>Claim Word</button>
            </form>

            <div className={`notice-strip notice-strip--${feedbackTone}`}>
              {feedback}
            </div>

            <section className="practice-grid">
              <article className="panel">
                <h3>Claimed Words</h3>
                <div className="word-grid">
                  {claimedWords.length ? (
                    claimedWords
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <div key={entry.word} className="word-chip">
                          <strong>{entry.word}</strong>
                          <span>+{entry.score}</span>
                        </div>
                      ))
                  ) : (
                    <div className="empty-card">
                      No words yet. Build a word from the tiles and claim it.
                    </div>
                  )}
                </div>
              </article>

              <article className="panel">
                <h3>Round Intel</h3>
                <div className="metrics-grid">
                  <MetricCard
                    label="Best word"
                    value={bestWord || "--"}
                    hint="Your longest accepted word so far"
                  />
                  <MetricCard
                    label="Current streak"
                    value={streak}
                    hint="Accepted words in a row"
                  />
                  <MetricCard
                    label="Round progress"
                    value={`${dictionaryProgress}%`}
                    hint={`${claimedWords.length}/${totalValidWords} words found`}
                  />
                  <MetricCard
                    label="Longest found"
                    value={longestWord || "--"}
                    hint="Best word discovered this round"
                  />
                </div>

                <div className="rules-card">
                  <h4>Scoring</h4>
                  <ul>
                    <li>3 letters = 3 points</li>
                    <li>4 letters = 5 points</li>
                    <li>5 letters = 8 points</li>
                    <li>6+ letters = 12 points</li>
                  </ul>
                </div>
              </article>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletStatus, setWalletStatus] = useState("");
  const [walletChainId, setWalletChainId] = useState(null);
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [roomSyncStatus, setRoomSyncStatus] = useState("idle");
  const [settings, setSettings] = useState({
    sound: true,
    haptics: true,
    highContrast: false,
    largeText: false,
    showEarnings: true,
    showRank: true,
  });

  const walletHint = useMemo(() => {
    if (!walletAddress.trim()) return "";
    const valid = isWalletAddress(walletAddress.trim());
    return valid
      ? parseChainId(walletChainId) === CELO_MAINNET_CHAIN_ID
        ? `Room identity will show as ${shortenWalletAddress(walletAddress.trim())} and your wallet is ready for Celo mainnet play.`
        : `Room identity will show as ${shortenWalletAddress(walletAddress.trim())}. Switch to Celo Mainnet before paying to join a live room.`
      : "Connected account is not a valid EVM wallet address.";
  }, [walletAddress, walletChainId]);
  const walletProviderName = useMemo(
    () => getWalletProviderName(getInjectedProvider()),
    [],
  );
  const walletNetworkLabel = useMemo(
    () => getNetworkLabel(walletChainId),
    [walletChainId],
  );
  const walletReady = Boolean(walletAddress) && parseChainId(walletChainId) === CELO_MAINNET_CHAIN_ID;

  useEffect(() => {
    const storedWallet =
      typeof window !== "undefined"
        ? window.localStorage.getItem(WALLET_STORAGE_KEY) || ""
        : "";

    if (isWalletAddress(storedWallet)) {
      setWalletAddress(storedWallet);
      setWalletStatus("Using previously connected wallet.");
    }

    const provider = getInjectedProvider();
    provider?.request?.({ method: "eth_chainId" })
      .then((chainId) => setWalletChainId(parseChainId(chainId)))
      .catch(() => {});

    if (!provider?.on) return undefined;

    function handleAccountsChanged(accounts) {
      const nextWallet = accounts?.[0] || "";
      if (isWalletAddress(nextWallet)) {
        setWalletAddress(nextWallet);
        setWalletStatus("Wallet changed.");
        window.localStorage.setItem(WALLET_STORAGE_KEY, nextWallet);
      } else {
        setWalletAddress("");
        setWalletStatus("Wallet disconnected.");
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    }

    function handleChainChanged(chainId) {
      const normalized = parseChainId(chainId);
      setWalletChainId(normalized);
      setWalletStatus(normalized === CELO_MAINNET_CHAIN_ID ? "Wallet ready on Celo Mainnet." : `Connected on ${getNetworkLabel(normalized)}.`);
    }

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
    if (!isWalletAddress(walletAddress)) return undefined;

    const session = readRoomSession();
    if (!session) return undefined;
    if (session.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) return undefined;
    if (room?.id === session.roomId && playerId === session.playerId) return undefined;

    let cancelled = false;

    async function restoreRoomSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/${session.roomId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to restore your room session.");
        }

        if (cancelled) return;

        const restoredPlayer = (data.room?.players || []).find(
          (entry) => entry.id === session.playerId,
        );

        if (
          !restoredPlayer ||
          restoredPlayer.walletAddress.toLowerCase() !== session.walletAddress.toLowerCase()
        ) {
          throw new Error("Saved room session no longer matches this wallet.");
        }

        setRoom(data.room);
        setPlayerId(session.playerId);
        setScreen(data.room.status === "waiting" ? "lobby" : "match-room");
        setRoomError("");
        setRoomMessage(
          data.room.status === "waiting"
            ? "Room restored from the backend."
            : data.room.status === "finished"
              ? "Finished room restored from the backend."
              : "Live room restored from the backend.",
        );
      } catch (error) {
        if (cancelled) return;
        clearRoomSession();
        setRoomError(error.message || "Unable to restore room session.");
      }
    }

    restoreRoomSession();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, room?.id, playerId]);

  async function connectWallet() {
    const provider = getInjectedProvider();

    if (!provider?.request) {
      setWalletStatus("No injected wallet found. Open WordPot inside MiniPay or a wallet browser.");
      return;
    }

    try {
      setWalletStatus("Requesting wallet connection...");
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      const nextWallet = accounts?.[0] || "";

      if (!isWalletAddress(nextWallet)) {
        throw new Error("Connected account is not a valid wallet address.");
      }

      setWalletStatus("Wallet connected. Preparing Celo Mainnet...");
      await ensureCeloMainnet(provider, CELO_MAINNET_CHAIN_ID);
      const chainId = await provider.request({ method: "eth_chainId" });

      setWalletAddress(nextWallet);
      setWalletChainId(parseChainId(chainId));
      setWalletStatus(`Ready on Celo Mainnet as ${shortenWalletAddress(nextWallet)}`);
      window.localStorage.setItem(WALLET_STORAGE_KEY, nextWallet);
    } catch (error) {
      setWalletStatus(error.message || "Unable to connect wallet.");
    }
  }

  async function handleHomeJoin() {
    setRoomError("");

    if (!walletAddress) {
      await connectWallet();
      return;
    }

    if (!walletReady) {
      await connectWallet();
      return;
    }

    await handleQuickMatch();
  }

  function disconnectWallet() {
    setWalletAddress("");
    setWalletChainId(null);
    setWalletStatus("Wallet disconnected locally.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }

  async function handleQuickMatch() {
    setRoomError("");
    setRoomMessage("");

    if (!isWalletAddress(walletAddress.trim())) {
      setRoomError("Connect a valid wallet before joining quick match.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/quick-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to join a quick match.");
      }

      setRoom(data.room);
      setPlayerId(data.playerId);
      saveRoomSession({
        roomId: data.room.id,
        playerId: data.playerId,
        walletAddress: walletAddress.trim(),
      });
      setRoomMessage("You joined a public room. Invite more players or refresh the lobby.");
      setScreen("lobby");
    } catch (error) {
      setRoomError(error.message || "Unable to join quick match.");
    }
  }

  async function refreshRoom(options = {}) {
    if (!room?.id) return;
    const { silent = false } = options;

    try {
      if (!silent) {
        setRoomSyncStatus("syncing");
      }

      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to refresh this room.");
      }

      const previousStatus = room?.status;
      const nextStatus = data.room.status;
      setRoom(data.room);
      setScreen(data.room.status === "waiting" ? "lobby" : "match-room");
      saveRoomSession({
        roomId: data.room.id,
        playerId,
        walletAddress: walletAddress.trim(),
      });

      if (!silent) {
        setRoomMessage(
          nextStatus === "waiting"
            ? "Lobby updated."
            : nextStatus === "finished"
              ? "Results updated."
              : "Room updated.",
        );
      } else if (previousStatus !== nextStatus) {
        setRoomMessage(
          nextStatus === "active"
            ? "The arena is live now."
            : nextStatus === "finished"
              ? "Round finished. Results are ready."
              : "Room state changed.",
        );
      }
      setRoomError("");
      setRoomSyncStatus("live");
    } catch (error) {
      if (!silent) {
        setRoomError(error.message || "Unable to refresh room.");
      } else {
        setRoomSyncStatus("retrying");
      }
    }
  }

  async function payEntryFeeOnchain() {
    if (!room?.id || !playerId) return;

    const provider = getInjectedProvider();
    if (!provider?.request) {
      setRoomError("Open WordPot inside MiniPay or a wallet browser to pay onchain.");
      return;
    }

    if (!isWalletAddress(walletAddress.trim())) {
      setRoomError("Connect a valid wallet before sending the join payment.");
      return;
    }

    const treasuryWallet = room?.onchain?.treasuryWallet;
    const joinPaymentWei = room?.onchain?.joinPaymentWei;
    const joinPaymentDisplay = room?.onchain?.joinPaymentDisplay || "0.001 CELO";

    if (!isWalletAddress(treasuryWallet) || !joinPaymentWei) {
      setRoomError("Onchain join is not configured yet. Add the treasury wallet in the server env.");
      return;
    }

    try {
      setPaymentBusy(true);
      setRoomError("");
      setRoomMessage("Confirm the entry payment in your wallet...");

      await ensureCeloMainnet(provider, room?.onchain?.chainId || CELO_MAINNET_CHAIN_ID);

      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress.trim(),
          to: treasuryWallet,
          value: `0x${BigInt(joinPaymentWei).toString(16)}`,
        }],
      });

      const recordResponse = await fetch(`${API_BASE_URL}/rooms/${room.id}/join-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
          txHash,
          amount: joinPaymentDisplay,
          mode: room?.onchain?.payoutMode || "treasury_beta",
        }),
      });
      const recordData = await recordResponse.json();

      if (!recordResponse.ok) {
        throw new Error(recordData.error || "Unable to record the onchain join transaction.");
      }

      setRoom(recordData.room);
      setRoomMessage("Entry confirmed. Your seat is now locked in.");
    } catch (error) {
      setRoomError(error.message || "Unable to complete the onchain join payment.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function startRoom() {
    if (!room?.id || !playerId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start this room.");
      }

      setRoom(data.room);
      saveRoomSession({
        roomId: data.room.id,
        playerId,
        walletAddress: walletAddress.trim(),
      });
      setRoomMessage("");
      setRoomError("");
      setRoomSyncStatus("live");
      setScreen("match-room");
    } catch (error) {
      setRoomError(error.message || "Unable to start room.");
    }
  }

  async function submitRoomWord(word) {
    if (!room?.id || !playerId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${room.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          walletAddress: walletAddress.trim(),
          word,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit word.");
      }

      setRoom(data.room);
      setRoomMessage(`Locked in ${data.submission.word} for +${data.submission.score} points.`);
      setRoomError("");
      setRoomSyncStatus("live");
    } catch (error) {
      setRoomError(error.message || "Unable to submit word.");
    }
  }

  async function claimRewardOnchain() {
    if (!room?.id || !playerId) return;

    if (room?.onchain?.payoutMode !== "contract_claim") {
      setRoomError("Reward claiming will go live after the WordPot payout contract is deployed.");
      return;
    }

    setClaimBusy(true);
    try {
      setRoomError("");
      setRoomMessage("Contract claim flow is the next onchain step. Deploy the contract and wire the room id to enable this button.");
    } catch (error) {
      setRoomError(error.message || "Unable to claim reward.");
    } finally {
      setClaimBusy(false);
    }
  }

  function backHome() {
    clearRoomSession();
    setRoom(null);
    setPlayerId("");
    setScreen("home");
    setRoomMessage("");
    setRoomError("");
    setRoomSyncStatus("idle");
  }

  function toggleSetting(key) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  useEffect(() => {
    if (screen !== "lobby" && screen !== "match-room") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      refreshRoom({ silent: true });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [screen, room?.id, playerId, walletAddress]);

  let content = (
    <HomeScreen
      onStartPractice={() => setScreen("practice")}
      onQuickMatch={handleHomeJoin}
      onOpenLeaderboard={() => setScreen("leaderboard")}
      onOpenProfile={() => setScreen("profile")}
      walletAddress={walletAddress}
      walletStatus={walletStatus}
      walletReady={walletReady}
      walletProviderName={walletProviderName}
      walletNetworkLabel={walletNetworkLabel}
      onConnectWallet={connectWallet}
      onDisconnectWallet={disconnectWallet}
      walletHint={walletHint}
      roomError={roomError}
    />
  );

  if (screen === "practice") {
    content = <PracticeScreen onExit={() => setScreen("home")} />;
  } else if (screen === "lobby") {
    content = (
      <LobbyScreen
        room={room}
        playerId={playerId}
        statusMessage={roomMessage}
        error={roomError}
        syncStatus={roomSyncStatus}
        onRefresh={refreshRoom}
        onStart={startRoom}
        onPayEntryFee={payEntryFeeOnchain}
        paymentBusy={paymentBusy}
        onBack={backHome}
      />
    );
  } else if (screen === "match-room") {
    content = (
      <MatchRoomScreen
        room={room}
        playerId={playerId}
        roomMessage={roomMessage}
        roomError={roomError}
        syncStatus={roomSyncStatus}
        onRefresh={refreshRoom}
        onSubmitWord={submitRoomWord}
        onClaimReward={claimRewardOnchain}
        claimBusy={claimBusy}
        onBackHome={backHome}
      />
    );
  } else if (screen === "profile") {
    content = (
      <ProfileScreen
        walletAddress={walletAddress}
        onConnectWallet={connectWallet}
        onBack={backHome}
      />
    );
  } else if (screen === "leaderboard") {
    content = (
      <LeaderboardScreen
        room={room}
        onQuickMatch={handleQuickMatch}
        onBack={backHome}
      />
    );
  } else if (screen === "settings") {
    content = (
      <SettingsScreen
        settings={settings}
        onToggle={toggleSetting}
        onBack={backHome}
      />
    );
  }

  return (
    <>
      <div className={`${settings.largeText ? "app-text-scale" : ""} ${settings.highContrast ? "app-high-contrast" : ""}`.trim()}>
        {content}
      </div>
      <AppBottomNav
        screen={screen}
        onNavigate={setScreen}
        walletAddress={walletAddress}
        onWalletAction={walletAddress ? disconnectWallet : connectWallet}
      />
    </>
  );
}
