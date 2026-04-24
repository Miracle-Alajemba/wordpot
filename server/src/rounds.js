import fs from "fs";

const DATAMUSE_API_URL = "https://api.datamuse.com/words";
const MIN_VALID_WORDS = 10;
const CACHE_TTL_MS = 10 * 60 * 1000;
const DICTIONARY_CANDIDATE_PATHS = [
  process.env.WORDPOT_DICTIONARY_PATH,
  "/usr/share/dict/words",
  "/usr/share/dict/american-english",
].filter(Boolean);

const SOURCE_WORD_POOL = [
  "BLOCKCHAIN",
  "REMITTANCE",
  "COMMUNITY",
  "STABLECOIN",
  "EDUCATION",
  "PLATFORM",
  "MIGRATION",
  "TREASURY",
  "CREATION",
  "LANGUAGE",
  "MOTIVATION",
  "FOUNDATION",
];

const EMERGENCY_SOURCE_WORDS = ["CREATION", "LANGUAGE", "TREASURY", "REMITTANCE"];

let lastSourceWord = "";
let cachedRounds = [];
let cacheExpiresAt = 0;
let dictionaryWords = [];
const derivedWordsCache = new Map();

function shuffle(items) {
  return items
    .slice()
    .sort(() => Math.random() - 0.5);
}

function loadDictionary() {
  if (dictionaryWords.length) return dictionaryWords;

  try {
    const dictionaryPath = DICTIONARY_CANDIDATE_PATHS.find((candidate) =>
      fs.existsSync(candidate),
    );
    if (!dictionaryPath) {
      throw new Error("No dictionary file was found on the server.");
    }

    const raw = fs.readFileSync(dictionaryPath, "utf8");
    dictionaryWords = uniqueWords(
      raw
        .split(/\r?\n/)
        .map((word) => String(word || "").trim().toLowerCase())
        .filter((word) => /^[a-z]+$/.test(word))
        .filter((word) => word.length >= 3 && word.length <= 12),
    ).sort();
  } catch (error) {
    console.error(
      `Unable to load WordPot dictionary: ${error.message}`,
    );
    dictionaryWords = [];
  }

  return dictionaryWords;
}

export function buildLetterCounts(word) {
  return word.split("").reduce((counts, letter) => {
    counts[letter] = (counts[letter] || 0) + 1;
    return counts;
  }, {});
}

export function canBuildFromSource(candidate, sourceWord) {
  const candidateCounts = buildLetterCounts(candidate.toLowerCase());
  const sourceCounts = buildLetterCounts(sourceWord.toLowerCase());

  return Object.entries(candidateCounts).every(
    ([letter, count]) => (sourceCounts[letter] || 0) >= count,
  );
}

function uniqueWords(words) {
  return [...new Set(words)];
}

export function deriveValidWords(sourceWord) {
  const normalizedSource = String(sourceWord || "").trim().toLowerCase();
  if (!normalizedSource) return [];

  if (derivedWordsCache.has(normalizedSource)) {
    return derivedWordsCache.get(normalizedSource);
  }

  const validWords = uniqueWords(
    loadDictionary().filter(
      (word) =>
        word.length <= normalizedSource.length &&
        canBuildFromSource(word, normalizedSource),
    ),
  ).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });

  derivedWordsCache.set(normalizedSource, validWords);
  return validWords;
}

function isDictionaryWord(word) {
  const normalized = String(word || "").trim().toLowerCase();
  if (!normalized) return false;
  return loadDictionary().includes(normalized);
}

function makeRound(sourceWord) {
  return {
    sourceWord,
    validWords: deriveValidWords(sourceWord),
  };
}

function isPlayableRound(round) {
  return round.validWords.length >= MIN_VALID_WORDS;
}

function getFallbackRounds() {
  const dictionaryRounds = shuffle(
    loadDictionary().filter(
      (word) =>
        word.length >= 8 &&
        word.length <= 12 &&
        new Set(word).size >= 5,
    ),
  )
    .slice(0, 250)
    .map((word) => word.toUpperCase())
    .map(makeRound)
    .filter(isPlayableRound);

  if (dictionaryRounds.length) {
    return dictionaryRounds;
  }

  return SOURCE_WORD_POOL
    .map(makeRound)
    .filter(isPlayableRound);
}

function pickFromRounds(rounds) {
  if (!rounds.length) {
    const emergencyRound = makeRound(
      EMERGENCY_SOURCE_WORDS[
        Math.floor(Math.random() * EMERGENCY_SOURCE_WORDS.length)
      ],
    );
    lastSourceWord = emergencyRound.sourceWord;
    return emergencyRound;
  }

  const candidates = rounds.filter((round) => round.sourceWord !== lastSourceWord);
  const pool = candidates.length ? candidates : rounds;
  const nextRound = pool[Math.floor(Math.random() * pool.length)];
  lastSourceWord = nextRound.sourceWord;
  return nextRound;
}

async function fetchDatamuseCandidates() {
  const patterns = [9, 10, 11, 12].map((length) => "?".repeat(length));
  const responses = await Promise.all(
    patterns.map(async (pattern) => {
      const url = new URL(DATAMUSE_API_URL);
      url.searchParams.set("sp", pattern);
      url.searchParams.set("max", "40");

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Datamuse returned ${response.status}`);
      }

      return response.json();
    }),
  );

  return responses
    .flat()
    .map((entry) => String(entry?.word || "").trim())
    .filter((word) => /^[a-z]+$/i.test(word))
    .filter((word) => isDictionaryWord(word))
    .map((word) => word.toUpperCase());
}

async function refillRoundCache() {
  try {
    const remoteSourceWords = await fetchDatamuseCandidates();
    const remoteRounds = uniqueWords(remoteSourceWords)
      .map(makeRound)
      .filter(isPlayableRound);

    if (remoteRounds.length) {
      cachedRounds = remoteRounds;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return;
    }
  } catch {
    // Fall through to the local fallback pool.
  }

  cachedRounds = getFallbackRounds();
  if (!cachedRounds.length) {
    cachedRounds = EMERGENCY_SOURCE_WORDS.map(makeRound).filter(isPlayableRound);
  }
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export async function getDynamicRound() {
  if (!cachedRounds.length || Date.now() > cacheExpiresAt) {
    await refillRoundCache();
  }

  return pickFromRounds(cachedRounds);
}
