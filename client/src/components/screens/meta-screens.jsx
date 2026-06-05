import { useEffect, useState } from "react";
import { MetricCard, PlayerIdentity } from "../ui";

import {
  getAvatarStyle,
  getPlayerAlias,
  isWalletAddress,
  shortenWalletAddress,
} from "../../utils/ui-helpers.js";

export function LeaderboardScreen({
  room,
  onQuickMatch,
  onBack,
  apiBaseUrl,
  walletAddress,
  walletReady,
  onConnectWallet,
  getInjectedProvider,
  getWalletClient,
  getPublicClient,
  ensureCeloMainnet,
  isMiniPay,
}) {
  const [activeTab, setActiveTab] = useState("seasonal");
  const [entries, setEntries] = useState([]);
  const [seasonalEntries, setSeasonalEntries] = useState([]);
  const [playerRecord, setPlayerRecord] = useState(null);
  const [seasonInfo, setSeasonInfo] = useState(null);
  const [treasuryWallet, setTreasuryWallet] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isBuyingBooster, setIsBuyingBooster] = useState(false);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError("");
      
      const query = walletAddress ? `?walletAddress=${encodeURIComponent(walletAddress)}` : "";
      const response = await fetch(`${apiBaseUrl}/leaderboard${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load leaderboard.");
      }

      setEntries(data.entries || []);
      setSeasonalEntries(data.seasonalEntries || []);
      setPlayerRecord(data.playerRecord || null);
      setSeasonInfo(data.seasonInfo || null);
      setTreasuryWallet(data.treasuryWallet || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [apiBaseUrl, walletAddress]);

  const handleRegisterSeason = async () => {
    if (!walletAddress) {
      onConnectWallet();
      return;
    }
    setUiMessage("");
    setIsRegistering(true);
    try {
      let txHash = "";
      
      if (walletReady && getInjectedProvider && getWalletClient && getPublicClient && treasuryWallet) {
        const provider = getInjectedProvider();
        if (provider?.request) {
          await ensureCeloMainnet(provider);
          const walletClient = getWalletClient();
          const publicClient = getPublicClient();
          if (walletClient && publicClient) {
            const [account] = await walletClient.getAddresses();
            txHash = await walletClient.sendTransaction({
              account,
              chain: walletClient.chain,
              to: treasuryWallet,
              value: BigInt(500000000000000000), // 0.5 CELO
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          }
        }
      }

      const res = await fetch(`${apiBaseUrl}/leaderboard/season/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, txHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register.");
      }
      setUiMessage("Success! You registered for Season 1.");
      await loadLeaderboard();
    } catch (err) {
      setUiMessage(`Registration failed: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBuyBooster = async () => {
    if (!walletAddress) {
      onConnectWallet();
      return;
    }
    setUiMessage("");
    setIsBuyingBooster(true);
    try {
      let txHash = "";

      if (walletReady && getInjectedProvider && getWalletClient && getPublicClient && treasuryWallet) {
        const provider = getInjectedProvider();
        if (provider?.request) {
          await ensureCeloMainnet(provider);
          const walletClient = getWalletClient();
          const publicClient = getPublicClient();
          if (walletClient && publicClient) {
            const [account] = await walletClient.getAddresses();
            txHash = await walletClient.sendTransaction({
              account,
              chain: walletClient.chain,
              to: treasuryWallet,
              value: BigInt(100000000000000000), // 0.1 CELO
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          }
        }
      }

      const res = await fetch(`${apiBaseUrl}/leaderboard/booster/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, txHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to purchase booster.");
      }
      setUiMessage("Double Score Booster activated for your next 3 games!");
      await loadLeaderboard();
    } catch (err) {
      setUiMessage(`Booster failed: ${err.message}`);
    } finally {
      setIsBuyingBooster(false);
    }
  };

  const activeEntries = activeTab === "seasonal" ? seasonalEntries : entries;

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>Back</button>
          <p className="eyebrow">Leaderboard Center</p>
        </div>

        <section className="profile-shell">
          {/* Season 1 Info Card */}
          <article className="panel profile-panel profile-panel--hero" style={{ border: "1px solid var(--accent-mint)", boxShadow: "0 0 15px rgba(99, 244, 202, 0.15)" }}>
            <div>
              <span className="rank-badge" style={{ background: "var(--accent-mint)", color: "#121212", fontWeight: "bold" }}>SEASON 1 IS LIVE 🏆</span>
              <h1 className="profile-title" style={{ marginTop: "8px" }}>Seasonal Arena</h1>
              <p className="profile-subtitle">Stake. Compete. Win your share of the weekly seasonal prize pool.</p>
              
              {walletAddress ? (
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {playerRecord?.registered ? (
                    <span style={{ color: "var(--accent-mint)", fontSize: "0.9em", display: "flex", alignItems: "center", gap: "6px" }}>
                      ✓ Season Registered (Score: {playerRecord.score} pts • {playerRecord.wins || 0} wins)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegisterSeason}
                      disabled={isRegistering}
                      className="primary-button"
                      style={{ background: "var(--accent-mint)", color: "#121212", width: "fit-content" }}
                    >
                      {isRegistering ? "Registering..." : "Buy Season Ticket (0.5 CELO)"}
                    </button>
                  )}

                  {playerRecord?.boosterGamesRemaining > 0 ? (
                    <span style={{ color: "#ffd700", fontSize: "0.9em", display: "flex", alignItems: "center", gap: "6px" }}>
                      🚀 2x Score Booster: {playerRecord.boosterGamesRemaining} games left
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBuyBooster}
                      disabled={isBuyingBooster}
                      className="secondary-button"
                      style={{ width: "fit-content", borderColor: "#ffd700", color: "#ffd700" }}
                    >
                      {isBuyingBooster ? "Activating..." : "Buy 2x Booster (0.1 CELO)"}
                    </button>
                  )}
                </div>
              ) : (
                <button type="button" onClick={onConnectWallet} style={{ marginTop: "12px" }}>Connect Wallet to Participate</button>
              )}
            </div>
          </article>

          {uiMessage ? (
            <div className="notice-strip notice-strip--success" style={{ margin: "10px 0", animation: "slideInUp 0.3s ease" }}>{uiMessage}</div>
          ) : null}

          <article className="panel profile-panel">
            {/* Tab Controls */}
            <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("seasonal")}
                style={{
                  background: "transparent",
                  color: activeTab === "seasonal" ? "var(--accent-mint)" : "rgba(255,255,255,0.6)",
                  border: "none",
                  borderBottom: activeTab === "seasonal" ? "2px solid var(--accent-mint)" : "none",
                  padding: "6px 12px",
                  fontWeight: activeTab === "seasonal" ? "bold" : "normal",
                  cursor: "pointer"
                }}
              >
                Season 1 Ladder
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("community")}
                style={{
                  background: "transparent",
                  color: activeTab === "community" ? "var(--accent-mint)" : "rgba(255,255,255,0.6)",
                  border: "none",
                  borderBottom: activeTab === "community" ? "2px solid var(--accent-mint)" : "none",
                  padding: "6px 12px",
                  fontWeight: activeTab === "community" ? "bold" : "normal",
                  cursor: "pointer"
                }}
              >
                All-Time Arena
              </button>
            </div>

            <div className="room-panel__header">
              <div>
                <h3>{activeTab === "seasonal" ? "Season 1 Competitors" : "Top Arena Players"}</h3>
                <p>{activeTab === "seasonal" ? "Only registered ticket holders are ranked in seasonal payout pools." : "Aggregated statistics across all active and historical rooms."}</p>
              </div>
            </div>

            {error ? <div className="notice-strip notice-strip--neutral">{error}</div> : null}
            
            {loading ? (
              <div className="empty-card">Loading standings...</div>
            ) : activeEntries.length ? (
              <div className="leaderboard-table">
                {activeEntries.map((entry, index) => (
                  <div key={`${entry.walletAddress}-${entry.rank || index}`} className={`leaderboard-table__row ${index === 0 ? "leaderboard-table__row--top" : ""}`}>
                    <div className="leaderboard-table__rank">#{entry.rank || index + 1}</div>
                    <PlayerIdentity walletAddress={entry.walletAddress} emphasis />
                    <div className="leaderboard-table__stats">
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--accent-mint)" }}>{entry.score} pts</strong>
                      <span>{entry.wordsFound} words • {entry.wins || 0} wins</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-card">
                {activeTab === "seasonal" 
                  ? "No competitors registered for Season 1 yet. Buy a ticket and take the #1 spot!" 
                  : "No player stats found. Finish a live match to start the ladder."}
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
  const alias = connected ? getPlayerAlias(walletAddress) : "Guest Player";

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
