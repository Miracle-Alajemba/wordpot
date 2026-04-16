import { useEffect, useMemo, useState } from "react";
import {
  evaluatePracticeSubmission,
  getWordScore,
  normalizeWord,
} from "../../game.js";
import { MetricCard, ScoreBadge } from "../ui/game-ui.jsx";

function buildWordFromSelection(sourceWord, selectedIndexes) {
  const letters = String(sourceWord || "").split("");
  return selectedIndexes.map((index) => letters[index] || "").join("").toLowerCase();
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

export function PracticeScreen({ onExit, apiBaseUrl, roundSeconds = 60 }) {
  const [roundSeed, setRoundSeed] = useState(null);
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
  const sourceLetters = String(roundSeed?.sourceWord || "").split("");
  const selectedWord = draftWord;

  async function loadPracticeRound(nextFeedback = "New round loaded. Go fast and go clean.") {
    setLoadingRound(true);
    setFeedback("Loading a fresh round...");
    setFeedbackTone("neutral");

    try {
      const response = await fetch(`${apiBaseUrl}/rounds/practice`);
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
