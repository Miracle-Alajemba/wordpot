import { useEffect, useMemo, useRef, useState } from "react";
import {
  canBuildFromSource,
  getWordScore,
  normalizeWord,
  pickPracticeRound,
} from "./game.js";

const ROUND_SECONDS = 60;

const GAME_RULES = [
  "Words must be at least 3 letters long",
  "Use each letter only as many times as it appears",
  "Every claimed word scores only once",
  "Longer words earn bigger points",
  "Practice mode is free while we build multiplayer",
];

function ScoreBadge({ label, value }) {
  return (
    <div className="score-badge">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HomeScreen({ onStartPractice }) {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MiniPay Word Game</p>
          <h1>WordPot</h1>
          <p className="lede">
            A fast multiplayer word challenge where players build words from a
            shared prompt, race the clock, and compete for the pot.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={onStartPractice}>
              Start Practice
            </button>
            <button type="button" className="button-secondary" disabled>
              Quick Match Soon
            </button>
          </div>
        </div>

        <div className="hero-card">
          <p className="hero-card__label">Sample round</p>
          <h2>BLOCKCHAIN</h2>
          <div className="hero-card__grid">
            <span>Timer: 60s</span>
            <span>Stake: 0.1 cUSD</span>
            <span>Players: 2-5</span>
            <span>Payout: 90%</span>
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
            <li>Winner gets the pot</li>
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
          <h3>Build Order</h3>
          <p>
            Practice mode comes first. Once the word validation and scoring feel
            right, we’ll layer in live rooms, staking, and automatic payouts.
          </p>
        </article>
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
  const [roundSeed, setRoundSeed] = useState(() => pickPracticeRound());
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Build as many valid words as you can.");
  const [claimedWords, setClaimedWords] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isFinished) return undefined;

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
  }, [isFinished, roundSeed.sourceWord]);

  useEffect(() => {
    if (!isFinished) {
      inputRef.current?.focus();
    }
  }, [isFinished]);

  const claimedSet = useMemo(
    () => new Set(claimedWords.map((entry) => entry.word)),
    [claimedWords],
  );

  function resetRound() {
    setRoundSeed(pickPracticeRound());
    setTimeLeft(ROUND_SECONDS);
    setInput("");
    setScore(0);
    setFeedback("New round. Go fast and go clean.");
    setClaimedWords([]);
    setIsFinished(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isFinished) {
      return;
    }

    const normalized = normalizeWord(input);
    setInput("");

    if (normalized.length < 3) {
      setFeedback("Too short. Words must be at least 3 letters.");
      return;
    }

    if (claimedSet.has(normalized)) {
      setFeedback("Already claimed in this round.");
      return;
    }

    if (!canBuildFromSource(normalized, roundSeed.sourceWord)) {
      setFeedback("That word uses letters outside the source word.");
      return;
    }

    if (!roundSeed.validWords.includes(normalized)) {
      setFeedback("Not in the practice dictionary for this round.");
      return;
    }

    const points = getWordScore(normalized);

    setClaimedWords((current) => [...current, { word: normalized, score: points }]);
    setScore((current) => current + points);
    setFeedback(`Locked in ${normalized} for +${points} points.`);
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
            <h1>{roundSeed.sourceWord}</h1>
            <p className="lede">
              Make real words from these letters before the timer runs out.
            </p>
          </div>

          <div className="score-row">
            <ScoreBadge label="Time left" value={`${timeLeft}s`} />
            <ScoreBadge label="Score" value={score} />
            <ScoreBadge label="Claimed" value={claimedWords.length} />
          </div>
        </div>

        {isFinished ? (
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
                ref={inputRef}
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type a word and hit enter"
                autoComplete="off"
                spellCheck="false"
              />
              <button type="submit">Claim Word</button>
            </form>

            <div className="notice-strip">{feedback}</div>

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
                      No words yet. Start with a clean 3-letter word and build up.
                    </div>
                  )}
                </div>
              </article>

              <article className="panel">
                <h3>Scoring</h3>
                <ul>
                  <li>3 letters = 3 points</li>
                  <li>4 letters = 5 points</li>
                  <li>5 letters = 8 points</li>
                  <li>6+ letters = 12 points</li>
                </ul>
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

  if (screen === "practice") {
    return <PracticeScreen onExit={() => setScreen("home")} />;
  }

  return <HomeScreen onStartPractice={() => setScreen("practice")} />;
}
