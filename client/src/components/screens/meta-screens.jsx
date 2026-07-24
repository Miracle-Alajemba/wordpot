import { useEffect, useState } from "react";
import { MetricCard, PlayerIdentity, GameLoader, UsernameModal } from "../ui";
import { getSavedUsername } from "../../utils/username.js";

import {
  getAvatarStyle,
  getPlayerAlias,
  isWalletAddress,
  shortenWalletAddress,
} from "../../utils/ui-helpers.js";

export function LeaderboardScreen({ room, onQuickMatch, onBack, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState("arena"); // "arena" or "daily"
  const [entries, setEntries] = useState([]);
  const [dailyEntries, setDailyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError("");
      
      const response = await fetch(`${apiBaseUrl}/leaderboard`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load leaderboard.");
      }

      setEntries(data.entries || []);
      setDailyEntries(data.dailyEntries || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [apiBaseUrl]);

  const activeEntries = activeTab === "arena" ? entries : dailyEntries;

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>Back</button>
          <p className="eyebrow">Leaderboard Center</p>
        </div>

        <section className="profile-shell">
          <article className="panel profile-panel">
            {/* Tab Controls */}
            <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("arena")}
                style={{
                  background: "transparent",
                  color: activeTab === "arena" ? "var(--accent-mint)" : "rgba(255,255,255,0.6)",
                  border: "none",
                  borderBottom: activeTab === "arena" ? "2px solid var(--accent-mint)" : "none",
                  padding: "6px 12px",
                  fontWeight: activeTab === "arena" ? "bold" : "normal",
                  cursor: "pointer"
                }}
              >
                Arena Matches
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("daily")}
                style={{
                  background: "transparent",
                  color: activeTab === "daily" ? "var(--accent-mint)" : "rgba(255,255,255,0.6)",
                  border: "none",
                  borderBottom: activeTab === "daily" ? "2px solid var(--accent-mint)" : "none",
                  padding: "6px 12px",
                  fontWeight: activeTab === "daily" ? "bold" : "normal",
                  cursor: "pointer"
                }}
              >
                Daily Challenge
              </button>
            </div>

            <div className="room-panel__header">
              <div>
                <h3>{activeTab === "arena" ? "Arena Rankings" : "Daily Challenge Standings"}</h3>
                <p>
                  {activeTab === "arena"
                    ? "Global players ranked by the points they have achieved in live matches."
                    : "Top players ranked by their high score in the Daily Challenge."}
                </p>
              </div>
            </div>

            {error ? <div className="notice-strip notice-strip--neutral">{error}</div> : null}
            
            {loading ? (
              <GameLoader label="Loading standings..." letters="LEADER" />
            ) : activeEntries.length ? (
              <div className="leaderboard-table">
                {activeEntries.map((entry, index) => (
                  <div key={`${entry.walletAddress}-${entry.rank || index}`} className={`leaderboard-table__row ${index === 0 ? "leaderboard-table__row--top" : ""}`}>
                    <div className="leaderboard-table__rank">#{entry.rank || index + 1}</div>
                    <PlayerIdentity walletAddress={entry.walletAddress} emphasis />
                    <div className="leaderboard-table__stats" style={{ textAlign: "right" }}>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-mint)", fontSize: "1.1rem" }}>
                        {entry.score} pts
                      </strong>
                      {activeTab === "daily" && (
                        <span style={{ fontSize: "0.8em", opacity: 0.6, display: "block" }}>
                          Total: {entry.totalScore} pts • {entry.roundsPlayed} play{entry.roundsPlayed === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-card">
                {activeTab === "arena"
                  ? "No player stats found. Finish a live match to start the leaderboard!"
                  : "No daily stats found. Play the Daily Challenge to start the leaderboard!"}
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

export function ProfileScreen({ walletAddress, onConnectWallet, onBack }) {
  const connected = isWalletAddress(walletAddress);
  const [alias, setAlias] = useState(connected ? getPlayerAlias(walletAddress) : "Guest Player");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (connected) {
      setAlias(getSavedUsername(walletAddress));
    }
  }, [walletAddress, connected]);

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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h1 className="profile-title" style={{ margin: 0 }}>{alias}</h1>
                  {connected && (
                    <button
                      type="button"
                      className="button-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem", minHeight: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => setModalOpen(true)}
                    >
                      ✏️ Edit Handle
                    </button>
                  )}
                </div>
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

        </section>
      </section>

      <UsernameModal
        walletAddress={walletAddress}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaveSuccess={(newHandle) => setAlias(newHandle)}
      />
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
