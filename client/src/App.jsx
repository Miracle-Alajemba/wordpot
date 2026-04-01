import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluatePracticeSubmission,
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
  "90% of the pot is shared by score",
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

function MetricCard({ label, value, hint }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
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
            shared prompt, race the clock, and earn a share of the pot based on
            how well they perform.
          </p>

          <div className="hero-actions">
            <button type="button" onClick={onStartPractice}>
              Start Practice
            </button>
            <button type="button" className="button-secondary" disabled>
              Quick Match Soon
            </button>
          </div>

          <div className="feature-strip">
            <div className="feature-pill">60 second rounds</div>
            <div className="feature-pill">0.1 cUSD stake</div>
            <div className="feature-pill">90% split by score</div>
          </div>
        </div>

        <div className="hero-card">
          <p className="hero-card__label">Sample round</p>
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
            <span>Stake: 0.1 cUSD</span>
            <span>Players: 2-5</span>
            <span>Pool: 90% shared by score</span>
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
            {GAME_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
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
  const [feedbackTone, setFeedbackTone] = useState("neutral");
  const [claimedWords, setClaimedWords] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [bestWord, setBestWord] = useState("");
  const [streak, setStreak] = useState(0);
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
  const progress = ((ROUND_SECONDS - timeLeft) / ROUND_SECONDS) * 100;
  const dictionaryProgress = Math.round(
    (claimedWords.length / roundSeed.validWords.length) * 100,
  );
  const longestWord = useMemo(() => {
    return claimedWords.reduce((current, entry) => {
      if (!current) return entry.word;
      return entry.word.length > current.length ? entry.word : current;
    }, "");
  }, [claimedWords]);

  function resetRound() {
    setRoundSeed(pickPracticeRound());
    setTimeLeft(ROUND_SECONDS);
    setInput("");
    setScore(0);
    setFeedback("New round. Go fast and go clean.");
    setFeedbackTone("neutral");
    setClaimedWords([]);
    setIsFinished(false);
    setBestWord("");
    setStreak(0);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isFinished) {
      return;
    }

    const normalized = normalizeWord(input);
    setInput("");
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
            <div className="letter-rack letter-rack--play">
              {roundSeed.sourceWord.split("").map((letter, index) => (
                <span key={`${letter}-${index}`} className="letter-tile letter-tile--play">
                  {letter}
                </span>
              ))}
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
                      No words yet. Start with a clean 3-letter word and build up.
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
                    hint={`${claimedWords.length}/${roundSeed.validWords.length} words found`}
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

export default function App() {
  const [screen, setScreen] = useState("home");

  if (screen === "practice") {
    return <PracticeScreen onExit={() => setScreen("home")} />;
  }

  return <HomeScreen onStartPractice={() => setScreen("practice")} />;
}
