import { useEffect, useState } from "react";
import { MetricCard, PlayerIdentity } from "../ui/game-ui.jsx";
import {
  getAvatarStyle,
  getPlayerAlias,
  isWalletAddress,
  shortenWalletAddress,
} from "../../utils/ui-helpers.js";

export function LeaderboardScreen({ room, onQuickMatch, onBack, apiBaseUrl }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${apiBaseUrl}/leaderboard`);
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
  }, [apiBaseUrl, room]);

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

export function ProfileScreen({ walletAddress, onConnectWallet, onBack }) {
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

export function SettingsScreen({ settings, onToggle, onBack }) {
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
              <button type="button" className="settings-row" onClick={() => onToggle("darkMode")}>
                <span>Theme mode</span>
                <strong>{settings.darkMode ? "Dark" : "Light"}</strong>
              </button>
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
