import { useEffect, useMemo, useState } from "react";
import {
  evaluatePracticeSubmission,
  getWordScore,
  normalizeWord,
} from "../../game.js";
import { isWalletAddress, shortenWalletAddress } from "../../utils/index.js";
import { MetricCard, ScoreBadge } from "../ui/game-ui.jsx";

const PRACTICE_DIFFICULTIES = [
  { id: "easy", label: "Warm Up" },
  { id: "medium", label: "Standard" },
  { id: "hard", label: "Expert" },
];

const PRACTICE_DIFFICULTY_NOTES = {
  easy: "Warm Up gives broader letter pools and easier words to spot quickly.",
  medium: "Standard balances speed and challenge with a tighter but still fair word pool.",
  hard: "Expert gives tighter, trickier rounds with fewer obvious words to find.",
};
const FREE_REWARD_TARGET_SCORE = 50;

function getDifficultyLabel(difficulty) {
  return (
    PRACTICE_DIFFICULTIES.find((entry) => entry.id === difficulty)?.label ||
    difficulty
  );
}

function buildWordFromSelection(sourceWord, selectedIndexes) {
  const letters = String(sourceWord || "").split("");
  return selectedIndexes.map((index) => letters[index] || "").join("").toLowerCase();
}

function PracticeResults({
  score,
  wordsFound,
  difficulty,
  walletAddress,
  rewardClaimBusy,
  rewardClaimStatus,
  rewardClaimError,
  rewardClaim,
  onClaimReward,
  onReplay,
  onExit,
}) {
  const canClaimReward = score >= FREE_REWARD_TARGET_SCORE;
  const walletConnected = isWalletAddress(walletAddress);

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

      <div className="claim-card">
        <div className="claim-card__top">
          <div>
            <span className="claim-card__label">Free Reward Challenge</span>
            <strong className="claim-card__amount">
              {canClaimReward ? "Unlocked" : `${Math.max(FREE_REWARD_TARGET_SCORE - score, 0)} pts away`}
            </strong>
          </div>
          <span className={`claim-card__status ${rewardClaim ? "claim-card__status--success" : canClaimReward ? "claim-card__status--ready" : ""}`}>
            {rewardClaim ? "Claim recorded" : canClaimReward ? "Ready to claim" : "Keep practicing"}
          </span>
        </div>
        <p className="claim-card__copy">
          Reach {FREE_REWARD_TARGET_SCORE} points in free practice, connect your wallet, and record a reward claim. No entry payment required.
        </p>
        <div className="claim-card__meta">
          <div className="claim-meta-chip">
            <span>Wallet</span>
            <strong>{walletConnected ? shortenWalletAddress(walletAddress) : "Not connected"}</strong>
          </div>
          <div className="claim-meta-chip">
            <span>Target</span>
            <strong>{FREE_REWARD_TARGET_SCORE} pts</strong>
          </div>
          <div className="claim-meta-chip">
            <span>Claim</span>
            <strong>{rewardClaim?.id || "Not recorded"}</strong>
          </div>
        </div>
        {rewardClaimStatus ? (
          <div className="notice-strip notice-strip--success">{rewardClaimStatus}</div>
        ) : null}
        {rewardClaimError ? (
          <div className="notice-strip notice-strip--error">{rewardClaimError}</div>
        ) : null}
        <div className="hero-actions">
          <button
            type="button"
            onClick={() => onClaimReward({ score, wordsFound, difficulty })}
            disabled={!canClaimReward || rewardClaimBusy || Boolean(rewardClaim)}
          >
            {rewardClaimBusy
              ? "Claiming..."
              : rewardClaim
                ? "Claim Recorded"
                : walletConnected
                  ? "Claim Free Reward"
                  : "Connect Wallet to Claim"}
          </button>
        </div>
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

export function PracticeScreen({
  onExit,
  apiBaseUrl,
  roundSeconds = 60,
  walletAddress = "",
  connectWallet,
}) {
  const [roundSeed, setRoundSeed] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
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
  const [rewardClaimBusy, setRewardClaimBusy] = useState(false);
  const [rewardClaimStatus, setRewardClaimStatus] = useState("");
  const [rewardClaimError, setRewardClaimError] = useState("");
  const [rewardClaim, setRewardClaim] = useState(null);
  const sourceLetters = String(roundSeed?.sourceWord || "").split("");
  const selectedWord = draftWord;
  const difficultyNote =
    PRACTICE_DIFFICULTY_NOTES[difficulty] ||
    PRACTICE_DIFFICULTY_NOTES.medium;

  async function loadPracticeRound(nextFeedback = "New round loaded. Go fast and go clean.") {
    setLoadingRound(true);
    setFeedback("Loading a fresh round...");
    setFeedbackTone("neutral");

    try {
      const response = await fetch(
        `${apiBaseUrl}/rounds/practice?difficulty=${encodeURIComponent(difficulty)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load a practice round.");
      }

      setRoundSeed(data.round);
      setTimeLeft(roundSeconds);
      setDraftWord("");
      setSelectedIndexes([]);
      setScore(0);
      setClaimedWords([]);
      setIsFinished(false);
      setBestWord("");
      setStreak(0);
      setRewardClaimStatus("");
      setRewardClaimError("");
      setRewardClaim(null);
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
  }, [difficulty]);

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
  const progress = ((roundSeconds - timeLeft) / roundSeconds) * 100;
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

  async function handleClaimFreeReward({ score: finalScore, wordsFound, difficulty }) {
    setRewardClaimStatus("");
    setRewardClaimError("");

    if (!isWalletAddress(walletAddress)) {
      if (typeof connectWallet === "function") {
        await connectWallet();
        setRewardClaimStatus("Wallet connection opened. After it connects, tap claim again.");
      } else {
        setRewardClaimError("Connect your wallet before claiming.");
      }
      return;
    }

    setRewardClaimBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/reward-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          score: finalScore,
          difficulty,
          wordsFound,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to record reward claim.");
      }

      setRewardClaim(data.claim);
      setRewardClaimStatus(data.message || "Free reward claim recorded.");
    } catch (error) {
      setRewardClaimError(error.message || "Unable to record reward claim.");
    } finally {
      setRewardClaimBusy(false);
    }
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

        <div className="practice-difficulty-bar">
          <div>
            <p className="play-label">Difficulty</p>
            <p className="field-hint">
              {difficultyNote}
            </p>
          </div>
          <div
            className="theme-toggle practice-difficulty-toggle"
            role="tablist"
            aria-label="Practice difficulty"
          >
            {PRACTICE_DIFFICULTIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`theme-toggle__option practice-difficulty-toggle__option ${difficulty === entry.id ? "theme-toggle__option--active practice-difficulty-toggle__option--active" : ""}`}
                onClick={() => setDifficulty(entry.id)}
                disabled={loadingRound && difficulty === entry.id}
                aria-pressed={difficulty === entry.id}
              >
                {entry.label}
              </button>
            ))}
          </div>
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
            <ScoreBadge label="Mode" value={getDifficultyLabel(difficulty)} />
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
            difficulty={difficulty}
            walletAddress={walletAddress}
            rewardClaimBusy={rewardClaimBusy}
            rewardClaimStatus={rewardClaimStatus}
            rewardClaimError={rewardClaimError}
            rewardClaim={rewardClaim}
            onClaimReward={handleClaimFreeReward}
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
