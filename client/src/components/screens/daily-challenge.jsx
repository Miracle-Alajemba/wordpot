import { useEffect, useMemo, useState } from "react";
import {
  evaluatePracticeSubmission,
  getWordScore,
  normalizeWord,
} from "../../game.js";

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
  onConnectWallet,
  onBack,
  dailyScore,
  onScoreUpdate,
  dailyClaimed,
  dailyClaimBusy,
  dailyClaimTx,
  dailyClaimError,
  dailyClaimMessage,
  onClaimDaily,
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
  const [loadingRound, setLoadingRound] = useState(true);

  const sourceLetters = String(roundSeed?.sourceWord || "").split("");
  const claimedSet = useMemo(
    () => new Set(claimedWords.map((entry) => entry.word)),
    [claimedWords],
  );
  const selectedWord = draftWord;
  const walletConnected = isWalletAddress(walletAddress);

  async function loadDailyRound(nextPhase = "idle") {
    setLoadingRound(true);
    setFeedback("Loading today's challenge word...");
    setFeedbackTone("neutral");

    try {
      const response = await fetch(`${apiBaseUrl}/rounds/daily-challenge`);
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
      setFeedback("Start today's challenge when you are ready.");
      setFeedbackTone("neutral");
    } catch (error) {
      setFeedback(error.message || "Unable to load Daily Challenge.");
      setFeedbackTone("error");
    } finally {
      setLoadingRound(false);
    }
  }

  useEffect(() => {
    loadDailyRound("idle");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const interval = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setPhase("finished");
          onScoreUpdate(score);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, score, onScoreUpdate]);

  function startChallenge() {
    setPhase("playing");
    setTimeLeft(DAILY_ROUND_SECONDS);
    setFeedback(`Build valid words fast. Reach ${DAILY_TARGET_SCORE} points to unlock today's reward.`);
    setFeedbackTone("neutral");
  }

  function resetChallenge() {
    loadDailyRound("idle");
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

  function handleSubmit(event) {
    event.preventDefault();
    if (phase !== "playing" || !roundSeed) return;

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
      return;
    }

    const points = evaluation.score ?? getWordScore(evaluation.word);
    setClaimedWords((current) => [
      ...current,
      { word: evaluation.word, score: points },
    ]);
    setScore((current) => {
      const nextScore = current + points;
      onScoreUpdate(nextScore);
      return nextScore;
    });
    setFeedback(evaluation.message);
    setFeedbackTone("success");
  }

  async function handleClaim() {
    if (!walletConnected) {
      await onConnectWallet();
      return;
    }
    await onClaimDaily();
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

  return (
    <main className="page-shell">
      <section className="play-shell">
        <div className="play-header">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <p className="eyebrow">Daily Challenge</p>
        </div>

        <div className="play-hero">
          <div>
            <p className="play-label">Today's Word</p>
            <h1>{roundSeed?.sourceWord || "LOADING"}</h1>
            <p className="lede">
              Score {DAILY_TARGET_SCORE} points in one free round to claim today's 0.01 CELO reward.
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
            <ScoreBadge label="Target" value={`${DAILY_TARGET_SCORE} pts`} />
            <ScoreBadge label="Time left" value={`${timeLeft}s`} />
            <ScoreBadge label="Score" value={score} />
            <ScoreBadge label="Words" value={claimedWords.length} />
          </div>
        </div>

        {loadingRound ? (
          <div className="results-sheet">
            <p className="eyebrow">Loading</p>
            <h2>...</h2>
            <p>Preparing today's Daily Challenge.</p>
          </div>
        ) : phase === "idle" ? (
          <div className="results-sheet">
            <p className="eyebrow">Ready</p>
            <h2>Daily Challenge</h2>
            <p>
              Start a free 60-second round. Reach {DAILY_TARGET_SCORE} points to unlock a once-per-day CELO reward.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={startChallenge}>
                Start Daily Challenge
              </button>
            </div>
          </div>
        ) : phase === "finished" ? (
          <div className="results-sheet">
            <p className="eyebrow">Daily Challenge Complete</p>
            <h2>{score} pts</h2>
            {score < DAILY_TARGET_SCORE ? (
              <>
                <p>
                  You scored {score} points. You need {DAILY_TARGET_SCORE} points to claim today's reward. Try again.
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
                <p>You reached the target. Claim today's 0.01 CELO reward.</p>
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
                      : walletConnected
                        ? "Claim 0.01 CELO"
                        : "Connect Wallet to Claim"}
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
              <button type="submit" disabled={!selectedWord}>
                Claim Word
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
