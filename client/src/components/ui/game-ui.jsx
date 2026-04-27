import {
  formatEventTime,
  formatRoomTimer,
  getAvatarStyle,
  getPlayerAlias,
  shortenWalletAddress,
} from "../../utils/ui-helpers.js";

export function ScoreBadge({ label, value }) {
  return (
    <div className="score-badge">
      <span>{label}</span>
      <strong className="live-score">{value}</strong>
    </div>
  );
}

export function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className="data-highlight">{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

export function TimerTone({ seconds }) {
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

export function PlayerIdentity({ walletAddress, emphasis = false }) {
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

export function RoomPlayersStrip({ players = [], scoreboard = [], playerId }) {
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

export function ChatMessage({ entry, isOwnMessage }) {
  if (entry.type === "system") {
    return (
      <div className="system-message">
        <span className="system-message__icon">+</span>
        <div className="system-message__body">
          <strong>[System]</strong>
          <span>{entry.message}</span>
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
