 import { useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  RoomPlayersStrip,
  TimerTone,
} from "../ui/game-ui.jsx";
import {
  getPlayerAlias,
  shortenHash,
  shortenWalletAddress,
} from "../../utils/ui-helpers.js";

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

function buildWordFromSelection(sourceWord, selectedIndexes) {
  const letters = String(sourceWord || "").split("");
  return selectedIndexes.map((index) => letters[index] || "").join("").toLowerCase();
}

export function HomeScreen({
  gameRules = [],
  onStartPractice,
  onQuickMatch,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenSettings,
  walletAddress,
  walletStatus,
  walletReady,
  walletProviderName,
  walletNetworkLabel,
  walletConnectLabel,
  walletEnvironmentHint,
  isMiniPay,
  hasInjectedProvider,
  onConnectWallet,
  onDisconnectWallet,
  walletHint,
  roomError,
  darkMode,
  onToggleTheme,
}) {
  const joinLabel = isMiniPay && hasInjectedProvider
    ? walletReady
      ? "Join Game"
      : "Open Quick Match"
    : !walletAddress
    ? walletConnectLabel || "Connect Wallet to Join"
    : walletReady
      ? "Join Game"
      : "Switch to Celo to Join";

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-copy__top">
            <p className="eyebrow">MiniPay Word Game</p>
            <button
              type="button"
              className="theme-toggle hero-theme-toggle"
              onClick={onToggleTheme}
              aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
            >
              <span className={`theme-toggle__option ${darkMode ? "theme-toggle__option--active" : ""}`}>Dark</span>
              <span className={`theme-toggle__option ${!darkMode ? "theme-toggle__option--active" : ""}`}>Light</span>
            </button>
          </div>
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

          {!hasInjectedProvider && !walletAddress ? (
            <div className="notice-strip notice-strip--neutral">
              Connect with MiniPay or any supported wallet to join live rooms.
            </div>
          ) : null}

          <div className="wallet-panel">
            <div className="wallet-panel__copy">
              <label>Wallet sign in</label>
              <strong>
                {walletAddress ? shortenWalletAddress(walletAddress) : "No wallet connected"}
              </strong>
              <div className="wallet-state-strip">
                <span className={`wallet-chip ${walletReady ? "wallet-chip--ok" : "wallet-chip--warn"}`}>
                  {walletAddress
                    ? walletReady
                      ? "Wallet connected • Ready to play"
                      : "Wallet connected • Setup needed"
                    : "No wallet connected"}
                </span>
              </div>
              <p className="field-hint">
                {walletHint ||
                  "Connect your MiniPay-compatible wallet so rooms use your real onchain identity."}
              </p>
            </div>
            <div className="wallet-panel__actions">
              <button type="button" onClick={onConnectWallet}>
                {walletAddress ? (walletReady ? "Reconnect Wallet" : "Switch to Celo") : walletConnectLabel || "Connect Wallet"}
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
          <div className="hero-card__top">
            <p className="hero-card__label">Sample round</p>
          </div>
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
            {!walletAddress && !isMiniPay ? (
              <button type="button" onClick={onConnectWallet}>
                Connect Wallet
              </button>
            ) : (
              <button type="button" className="button-secondary" onClick={onOpenSettings}>
                Display Settings
              </button>
            )}
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
            {gameRules.length ? (
              gameRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))
            ) : (
              <li>Rules are loading for this round.</li>
            )}
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

export function LobbyScreen({
  room,
  playerId,
  statusMessage,
  error,
  syncStatus,
  onRefresh,
  onStart,
  onCancel,
  onPayEntryFee,
  paymentBusy,
  onBack,
  paymentProviderLabel,
}) {
  const syncMeta = getSyncStatusMeta(syncStatus);
  const isHost = room?.hostPlayerId === playerId;
  const minPlayers = room?.minPlayers || 2;
  const paidPlayersCount = room?.onchain?.paidPlayersCount || 0;
  const totalPlayers = room?.players?.length || 0;
  const allPaid = totalPlayers > 0 && paidPlayersCount === totalPlayers;
  const enoughPlayers = totalPlayers >= minPlayers;
  const roomReadyToStart = enoughPlayers && allPaid;
  const joinMode = room?.onchain?.joinMode || "treasury_beta";
  const canStart =
    room?.status === "waiting" && enoughPlayers && isHost && allPaid;
  const joinPayment = room?.onchain?.joinPaymentDisplay || "0.001 CELO";
  const hasPaid = (room?.onchain?.joinTransactions || []).some((entry) => entry.playerId === playerId);
  const unpaidPlayers = (room?.players || []).filter((entry) => !entry.joinPaid);
  const unpaidCount = unpaidPlayers.length;
  const joinedCount = room?.players?.length || 0;
  const lobbyTitle = !hasPaid
    ? "Complete your entry to confirm your seat in this round."
    : roomReadyToStart
      ? isHost
        ? "Everyone is ready. You can start the round now."
        : "Everyone is ready. Waiting for the host to begin."
      : allPaid
        ? `Your entry is confirmed. Need ${Math.max(minPlayers - totalPlayers, 0)} more player${Math.max(minPlayers - totalPlayers, 0) === 1 ? "" : "s"} to start. The room can still fill up to ${room?.maxPlayers || 5} players.`
        : "Your entry is confirmed. Waiting for the rest of the room.";
  const readinessCount = enoughPlayers
    ? `${paidPlayersCount}/${totalPlayers || 0}`
    : `${joinedCount}/${minPlayers}`;
  const readinessCaption = roomReadyToStart
    ? "Minimum players reached and every joined player has confirmed entry."
    : enoughPlayers
      ? "Joined players who have completed entry payment."
      : `Need ${Math.max(minPlayers - joinedCount, 0)} more player${Math.max(minPlayers - joinedCount, 0) === 1 ? "" : "s"} to start. The room can still fill up to ${room?.maxPlayers || 5} players.`;

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
          <article className="panel room-panel room-panel--feed">
            <div className="room-panel__header">
              <div>
                <h3>Match Lobby</h3>
                <p>{lobbyTitle}</p>
              </div>
              <TimerTone seconds={0} />
            </div>

            <div className={`lobby-readiness-card ${roomReadyToStart ? "lobby-readiness-card--ready" : ""}`}>
              <div>
                <span className="lobby-readiness-card__label">Round status</span>
                <strong>
                  {roomReadyToStart
                    ? "Ready to start"
                    : enoughPlayers
                      ? "Waiting for player confirmations"
                      : "Waiting for more players"}
                </strong>
              </div>
              <div className="lobby-readiness-card__progress">
                <div className="lobby-readiness-card__count">{readinessCount}</div>
                <small>{readinessCaption}</small>
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
              <div className="lobby-stat-card">
                <span>Start Rule</span>
                <strong>{minPlayers} paid players minimum</strong>
              </div>
            </div>

            <div className="notice-strip notice-strip--neutral">
              {joinMode === "contract_join"
                ? `Contract room ${room?.onchain?.contractRoomId ?? "--"} is live on WordPotArena. Players join this room onchain before the match starts.`
                : "Treasury beta mode is active for this room while contract-backed joins are still being prepared."}
            </div>

            <div className="notice-strip notice-strip--neutral">
              {hasPaid
                ? `Entry confirmed. Payment reference: ${shortenHash((room?.onchain?.joinTransactions || []).find((entry) => entry.playerId === playerId)?.txHash)}`
                : `Pay ${joinPayment} to confirm your seat. The round starts once every joined player has paid.`}
            </div>

            {!roomReadyToStart ? (
              <div className="notice-strip notice-strip--neutral">
                {!enoughPlayers
                  ? `At least ${minPlayers} players are needed before the round can begin. Need ${Math.max(minPlayers - joinedCount, 0)} more player${Math.max(minPlayers - joinedCount, 0) === 1 ? "" : "s"} to start. Players can still join until the room reaches ${room?.maxPlayers || 5}.`
                  : unpaidCount
                  ? `Waiting for ${unpaidCount} player${unpaidCount > 1 ? "s" : ""} to confirm entry: ${unpaidPlayers.map((entry) => getPlayerAlias(entry.walletAddress)).join(", ")}.`
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
                {paymentBusy ? "Processing..." : hasPaid ? "Entry Paid" : `${paymentProviderLabel || "Pay"} ${joinPayment}`}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={onStart}
                disabled={!canStart}
              >
                {isHost
                  ? roomReadyToStart
                    ? "Start Arena"
                    : enoughPlayers
                      ? "Waiting for payments"
                      : "Waiting for more players"
                  : "Waiting for host"}
              </button>
            </div>
            {isHost && (
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={onCancel}
                  style={{
                    backgroundColor: "#dd3333",
                    color: "white",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.25rem",
                    border: "none",
                    fontSize: "1rem",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  🚨 Cancel & Refund All
                </button>
              </div>
            )}
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

export function MatchRoomScreen({
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

            <form className="submit-panel submit-panel--prominent" onSubmit={handleSubmit}>
              <div className="submit-panel__locked" aria-live="polite">
                <span className="submit-panel__locked-label">Your Word</span>
                <strong>{selectedWord ? selectedWord.toUpperCase() : "Tap letters above to build"}</strong>
              </div>
              <div className="submit-panel__actions">
                <button type="button" className="button-secondary" onClick={clearSelection}>
                  Clear
                </button>
                <button
                  type="submit"
                  className="button-submit-soft"
                  disabled={timeLeft === 0 || !selectedWord}
                  style={{ flex: 1, padding: "0.875rem 1.5rem", fontSize: "1rem", fontWeight: "600" }}
                >
                  ✓ Submit Word
                </button>
              </div>
            </form>

            <RoomPlayersStrip players={room?.players} scoreboard={room?.scoreboard} playerId={playerId} />

            <section className="chat-room-layout" style={{ marginBottom: "6rem" }}>
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
