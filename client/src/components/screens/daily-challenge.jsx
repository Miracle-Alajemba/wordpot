import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeWord } from "../../game.js";

const DAILY_TARGET_SCORE = 40;
const DAILY_ROUND_SECONDS = 60;

function isWalletAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

function ScoreBadge({ label, value }) {
  return (
    <div className="score-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildWordFromSelection(sourceWord, selectedIndexes) {
  const letters = String(sourceWord || "").split("");
  return selectedIndexes.map((index) => letters[index] || "").join("").toLowerCase();
}

export function DailyChallenge({
  apiBaseUrl,
  walletAddress,
  walletReady,
  onConnectWallet,
  onBack,
  onScoreUpdate,
  dailyClaimed,
  dailyPlayed,
  dailyNextAvailableAt,
  dailyClaimBusy,
  dailyClaimTx,
  dailyClaimError,
  dailyClaimMessage,
  onRecordPlay,
  onClaimDaily,
  onRefreshStatus,
  getInjectedProvider,
  getWalletClient,
  getPublicClient,
  ensureCeloMainnet,
}) {
  const [roundSeed, setRoundSeed] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [timeLeft, setTimeLeft] = useState(DAILY_ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [draftWord, setDraftWord] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [claimedWords, setClaimedWords] = useState([]);
  const [feedback, setFeedback] = useState("Start today's challenge when you are ready.");
  const [feedbackTone, setFeedbackTone] = useState("neutral");
  const [loadingRound, setLoadingRound] = useState(false);
  const [wordSubmitBusy, setWordSubmitBusy] = useState(false);
  const [currentPlayStarted, setCurrentPlayStarted] = useState(false);
  const wordSubmitBusyRef = useRef(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [treasuryWallet, setTreasuryWallet] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  useEffect(() => {
    if (walletAddress) {
      fetch(`${apiBaseUrl}/daily/status?walletAddress=${encodeURIComponent(walletAddress.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.treasuryWallet) {
            setTreasuryWallet(data.treasuryWallet);
          }
        })
        .catch((err) => console.warn("Failed to load daily status details", err));
    }
  }, [apiBaseUrl, walletAddress]);

  const handleBuyRetryTicket = async () => {
    setRetryError("");
    setIsRetrying(true);
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
              value: BigInt(50000000000000000), // 0.05 CELO
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });
          }
        }
      }

      const response = await fetch(`${apiBaseUrl}/daily/retry-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletAddress.trim(), txHash }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to purchase retry ticket.");
      }
      
      if (onRefreshStatus) {
        await onRefreshStatus();
      }
      resetChallenge();
    } catch (err) {
      setRetryError(err.message || "Failed to buy retry ticket.");
    } finally {
      setIsRetrying(false);
    }
  };
  const cooldownRef = useRef(null);

  const sourceLetters = String(roundSeed?.sourceWord || "").split("");
  const claimedSet = useMemo(
    () => new Set(claimedWords.map((entry) => entry.word)),
    [claimedWords],
  );
  const selectedWord = draftWord;
  const walletConnected = isWalletAddress(walletAddress);

  async function loadDailyRound(
    difficulty = "medium",
    nextPhase = "idle",
    nextFeedback = "Start today's challenge when you are ready.",
  ) {
    setLoadingRound(true);
    setFeedback("Loading today's challenge word...");
    setFeedbackTone("neutral");

    try {
      const response = await fetch(
        `${apiBaseUrl}/rounds/daily-challenge?walletAddress=${encodeURIComponent(walletAddress.trim())}&difficulty=${encodeURIComponent(difficulty)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load Daily Challenge.");
      }

      setRoundSeed(data.round);
      setPhase(nextPhase);
      setTimeLeft(DAILY_ROUND_SECONDS);
      setScore(0);
      onScoreUpdate(0);
      setDraftWord("");
      setSelectedIndexes([]);
      setClaimedWords([]);
      setFeedback(nextFeedback);
      setFeedbackTone("neutral");
    } catch (error) {
      setFeedback(error.message || "Unable to load Daily Challenge.");
      setFeedbackTone("error");
    } finally {
      setLoadingRound(false);
    }
  }

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setPhase("finished");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase]);

  async function startChallenge(difficulty = "medium") {
    if (loadingRound) return;

    setCurrentPlayStarted(true);
    const allowed = await onRecordPlay();
    if (!allowed) {
      setCurrentPlayStarted(false);
      return;
    }

    const rules = {
      easy: { target: 20, reward: "0.005 CELO" },
      medium: { target: 40, reward: "0.01 CELO" },
      hard: { target: 60, reward: "0.02 CELO" }
    };
    const target = rules[difficulty]?.target || 40;
    const reward = rules[difficulty]?.reward || "0.01 CELO";

    await loadDailyRound(
      difficulty,
      "playing",
      `Build valid words fast. Reach ${target} points to unlock today's ${reward} reward.`,
    );
  }

  function resetChallenge() {
    setRoundSeed(null);
    setPhase("idle");
    setTimeLeft(DAILY_ROUND_SECONDS);
    setScore(0);
    onScoreUpdate(0);
    setDraftWord("");
    setSelectedIndexes([]);
    setClaimedWords([]);
    setCurrentPlayStarted(false);
    setFeedback("Start today's challenge when you are ready.");
    setFeedbackTone("neutral");
  }

  function handleToggleTile(index) {
    if (phase !== "playing") return;

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

  async function submitSelectedWord() {
    if (phase !== "playing" || !roundSeed || wordSubmitBusyRef.current) return;

    const normalized = normalizeWord(selectedWord);
    if (!normalized) return;

    wordSubmitBusyRef.current = true;
    setWordSubmitBusy(true);
    setDraftWord("");
    setSelectedIndexes([]);

    if (claimedSet.has(normalized)) {
      setFeedback("Already claimed in this round.");
      setFeedbackTone("error");
      wordSubmitBusyRef.current = false;
      setWordSubmitBusy(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/daily/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddress.trim(),
          sessionId: roundSeed.id,
          word: normalized,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to claim this word.");
      }

      setClaimedWords((current) => [
        ...current,
        { word: data.word, score: data.score },
      ]);
      setScore(data.totalScore);
      onScoreUpdate(data.totalScore);
      setFeedback(data.message || `Locked in ${data.word} for +${data.score} points.`);
      setFeedbackTone("success");
    } catch (error) {
      setFeedback(error.message || "Unable to claim this word.");
      setFeedbackTone("error");
    } finally {
      wordSubmitBusyRef.current = false;
      setWordSubmitBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitSelectedWord();
  }

  useEffect(() => {
    if (phase !== "playing" || !roundSeed) return undefined;

    function handleKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTypingField) return;

      if (event.key === "Enter") {
        if (!selectedWord || wordSubmitBusyRef.current) return;
        event.preventDefault();
        submitSelectedWord();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setSelectedIndexes((current) => {
          const nextIndexes = current.slice(0, -1);
          setDraftWord(buildWordFromSelection(roundSeed.sourceWord, nextIndexes));
          return nextIndexes;
        });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (/^[a-zA-Z]$/.test(event.key)) {
        const typedLetter = event.key.toLowerCase();
        const letters = String(roundSeed.sourceWord || "").toLowerCase().split("");

        setSelectedIndexes((current) => {
          const nextIndex = letters.findIndex(
            (letter, index) => letter === typedLetter && !current.includes(index),
          );

          if (nextIndex === -1) {
            setFeedback(`No unused "${typedLetter.toUpperCase()}" tile is available.`);
            setFeedbackTone("error");
            return current;
          }

          event.preventDefault();
          const nextIndexes = [...current, nextIndex];
          setDraftWord(buildWordFromSelection(roundSeed.sourceWord, nextIndexes));
          return nextIndexes;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, roundSeed, selectedWord, selectedIndexes, claimedSet]);

  useEffect(() => {
    if (!dailyNextAvailableAt) {
      setCooldownSeconds(0);
      return undefined;
    }

    function update() {
      const diff = Math.max(
        0,
        Math.ceil((new Date(dailyNextAvailableAt).getTime() - Date.now()) / 1000),
      );
      setCooldownSeconds(diff);
    }

    update();
    const interval = window.setInterval(update, 1000);
    cooldownRef.current = interval;
    return () => window.clearInterval(interval);
  }, [dailyNextAvailableAt]);

  async function handleClaim() {
    if (!walletConnected || !walletReady) {
      await onConnectWallet();
      return;
    }
    await onClaimDaily(roundSeed?.id);
  }

  // Wallet gate — must be after all hooks
  if (!walletConnected) {
    return (
      <main className="page-shell">
        <section className="play-shell">
          <div className="play-header">
            <button type="button" className="ghost-button" onClick={onBack}>
              Back
            </button>
            <p className="eyebrow">Daily Challenge</p>
          </div>
          <div className="results-sheet" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏆</div>
            <h2>Sign In to Play</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Connect your Celo wallet to play the Daily Challenge and claim your 0.01 CELO reward once per day.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={onConnectWallet}>
                Connect Wallet
              </button>
              <button type="button" className="button-secondary" onClick={onBack}>
                Go Back
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (dailyPlayed && !dailyClaimed && !currentPlayStarted) {
    return (
      <main className="page-shell">
        <section className="play-shell">
          <div className="play-header">
            <button type="button" className="ghost-button" onClick={onBack}>
              Back
            </button>
            <p className="eyebrow">Daily Challenge</p>
          </div>
          <div className="results-sheet" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
            <h2>Next Play Available In</h2>
            <p style={{ marginBottom: "0.5rem" }}>
              {cooldownSeconds > 0
                ? `${Math.floor(cooldownSeconds / 3600)}h ${Math.floor((cooldownSeconds % 3600) / 60)}m ${cooldownSeconds % 60}s`
                : "Less than a minute"}
            </p>
            <p style={{ marginBottom: "1.5rem" }}>
              Come back when the timer expires to play again and try claiming another reward.
            </p>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem", marginTop: "1rem", width: "100%" }}>
              <h4 style={{ color: "var(--accent-mint)" }}>Can't wait? ⚡</h4>
              <p style={{ fontSize: "0.85em", opacity: 0.8, marginBottom: "1.5rem" }}>
                Skip the cooldown and play again immediately with a retry ticket.
              </p>
              <button
                type="button"
                onClick={handleBuyRetryTicket}
                disabled={isRetrying}
                className="primary-button"
                style={{ background: "var(--accent-mint)", color: "#121212", padding: "0.75rem 1.5rem", borderRadius: "8px", fontWeight: "bold" }}
              >
                {isRetrying ? "Processing..." : "Buy Retry Ticket (0.05 CELO)"}
              </button>
              {retryError ? (
                <div className="notice-strip notice-strip--error" style={{ marginTop: "10px" }}>{retryError}</div>
              ) : null}
            </div>

            <div className="hero-actions" style={{ justifyContent: "center", marginTop: "2rem" }}>
               <button type="button" className="button-secondary" onClick={onBack}>
                 Back to Home
               </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (dailyClaimed) {
    return (
      <main className="page-shell">
        <section className="play-shell">
          <div className="play-header">
            <button type="button" className="ghost-button" onClick={onBack}>
              Back
            </button>
            <p className="eyebrow">Daily Challenge</p>
          </div>
          <div className="results-sheet" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🏆</div>
            <h2>Already Claimed Today</h2>
            <p style={{ marginBottom: "0.5rem" }}>
              You have already claimed your 0.01 CELO reward today.
            </p>
            <p style={{ marginBottom: "1.5rem" }}>
              Come back tomorrow for your next reward.
            </p>
            {dailyClaimTx ? (
              <div className="notice-strip notice-strip--success" style={{ marginBottom: "1.5rem" }}>
                Today's claim TX:{" "}
                <a
                  href={`https://celoscan.io/tx/${dailyClaimTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {dailyClaimTx.slice(0, 10)}...{dailyClaimTx.slice(-8)}
                </a>
              </div>
            ) : null}
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <button type="button" className="button-secondary" onClick={onBack}>
                Back to Home
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <p className="eyebrow">Daily Challenge</p>
        </div>

        {!loadingRound && phase !== "idle" ? (
          <div className="play-hero">
            <div>
              <p className="play-label">Today's Word</p>
              <h1>{roundSeed?.sourceWord || "LOADING"}</h1>
              <p className="lede">
                Score {roundSeed?.targetScore || 40} points in one free round to claim today's {roundSeed?.rewardDisplay || "0.01 CELO"} reward.
              </p>
              <div className="letter-rack letter-rack--play">
                {sourceLetters.map((letter, index) => (
                  <button
                    key={`${letter}-${index}`}
                    type="button"
                    className={`letter-tile letter-tile--play letter-tile--interactive ${selectedIndexes.includes(index) ? "letter-tile--selected" : ""}`}
                    onClick={() => handleToggleTile(index)}
                    disabled={phase !== "playing"}
                    aria-label={`Select letter ${letter}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <div className="word-preview word-preview--practice">
                {selectedWord
                  ? selectedWord.toUpperCase().split("").join(" - ")
                  : "Tap letters to form a word"}
              </div>
            </div>

            <div className="score-row">
              <ScoreBadge label="Target" value={`${roundSeed?.targetScore || 40} pts`} />
              <ScoreBadge label="Time left" value={`${timeLeft}s`} />
              <ScoreBadge label="Score" value={score} />
              <ScoreBadge label="Words" value={claimedWords.length} />
            </div>
          </div>
        ) : null}

        {loadingRound ? (
          <div className="results-sheet">
            <p className="eyebrow">Loading</p>
            <h2>...</h2>
            <p>Preparing today's Daily Challenge.</p>
          </div>
        ) : phase === "idle" ? (
          <div className="results-sheet" style={{ maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem", textAlign: "center" }}>🏆</div>
            <p className="eyebrow">Ready</p>
            <h2>Daily Challenge</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Select your difficulty level. Each level has a different score target and reward payout. You can play once per day.
            </p>
            <div className="difficulty-choices" style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", marginBottom: "1.5rem" }}>
              <button
                type="button"
                className="difficulty-card"
                onClick={() => startChallenge("easy")}
                disabled={loadingRound}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem 1.5rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(141, 163, 255, 0.12)",
                  borderLeft: "4px solid #63f4ca",
                  borderRadius: "16px",
                  textAlign: "left",
                  color: "#f5f7ff",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <div>
                  <strong style={{ fontSize: "1.1rem", display: "block", color: "#ffffff", fontWeight: "700", marginBottom: "0.25rem" }}>🎮 Easy</strong>
                  <span style={{ fontSize: "0.82rem", color: "#63f4ca", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" }}>Target: 20 pts</span>
                </div>
                <strong style={{ color: "#ffffff", fontSize: "1.15rem", fontFamily: "var(--font-mono)", fontWeight: "700" }}>0.005 CELO</strong>
              </button>

              <button
                type="button"
                className="difficulty-card"
                onClick={() => startChallenge("medium")}
                disabled={loadingRound}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem 1.5rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(141, 163, 255, 0.12)",
                  borderLeft: "4px solid #63f4ca",
                  borderRadius: "16px",
                  textAlign: "left",
                  color: "#f5f7ff",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <div>
                  <strong style={{ fontSize: "1.1rem", display: "block", color: "#ffffff", fontWeight: "700", marginBottom: "0.25rem" }}>⚔️ Medium</strong>
                  <span style={{ fontSize: "0.82rem", color: "#63f4ca", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" }}>Target: 40 pts</span>
                </div>
                <strong style={{ color: "#ffffff", fontSize: "1.15rem", fontFamily: "var(--font-mono)", fontWeight: "700" }}>0.010 CELO</strong>
              </button>

              <button
                type="button"
                className="difficulty-card"
                onClick={() => startChallenge("hard")}
                disabled={loadingRound}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem 1.5rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(141, 163, 255, 0.12)",
                  borderLeft: "4px solid #63f4ca",
                  borderRadius: "16px",
                  textAlign: "left",
                  color: "#f5f7ff",
                  cursor: "pointer",
                  width: "100%"
                }}
              >
                <div>
                  <strong style={{ fontSize: "1.1rem", display: "block", color: "#ffffff", fontWeight: "700", marginBottom: "0.25rem" }}>👑 Hard</strong>
                  <span style={{ fontSize: "0.82rem", color: "#63f4ca", fontWeight: "700", letterSpacing: "0.06em", textTransform: "uppercase" }}>Target: 60 pts</span>
                </div>
                <strong style={{ color: "#ffffff", fontSize: "1.15rem", fontFamily: "var(--font-mono)", fontWeight: "700" }}>0.020 CELO</strong>
              </button>
            </div>
          </div>
        ) : phase === "finished" ? (
          <div className="results-sheet">
            <p className="eyebrow">Daily Challenge Complete</p>
            <h2>{score} pts</h2>
            {score < (roundSeed?.targetScore || 40) ? (
              <>
                <p>
                  You scored {score} points. You need {roundSeed?.targetScore || 40} points to claim today's reward. Try again.
                </p>
                <div className="hero-actions">
                  <button type="button" onClick={resetChallenge}>
                    Play Again
                  </button>
                </div>
              </>
            ) : dailyClaimed ? (
              <>
                <div className="notice-strip notice-strip--success">
                  Claimed Today ✓ Come back tomorrow for your next reward.
                </div>
                {dailyClaimTx ? (
                  <p>
                    TX:{" "}
                    <a
                      href={`https://celoscan.io/tx/${dailyClaimTx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {dailyClaimTx.slice(0, 10)}...
                    </a>
                  </p>
                ) : null}
                <div className="hero-actions">
                  <button type="button" className="button-secondary" onClick={resetChallenge}>
                    Play Again
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>You reached the target. Claim today's {roundSeed?.rewardDisplay || "0.01 CELO"} reward.</p>
                {dailyClaimMessage ? (
                  <div className="notice-strip notice-strip--success">{dailyClaimMessage}</div>
                ) : null}
                {dailyClaimError ? (
                  <div className="notice-strip notice-strip--error">{dailyClaimError}</div>
                ) : null}
                <div className="hero-actions">
                  <button type="button" onClick={handleClaim} disabled={dailyClaimBusy}>
                    {dailyClaimBusy
                      ? "Sending reward..."
                      : walletConnected && walletReady
                        ? `Claim ${roundSeed?.rewardDisplay || "0.01 CELO"}`
                        : "Reconnect Wallet to Claim"}
                  </button>
                </div>
              </>
            )}
          </div>
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
              <button type="submit" disabled={!selectedWord || wordSubmitBusy}>
                {wordSubmitBusy ? "Claiming..." : "Claim Word"}
              </button>
            </form>

            <div className={`notice-strip notice-strip--${feedbackTone}`}>
              {feedback}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
