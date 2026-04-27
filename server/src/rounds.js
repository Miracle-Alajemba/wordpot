import fs from "fs";
import { fileURLToPath } from "url";

const DATAMUSE_API_URL = "https://api.datamuse.com/words";
const MIN_VALID_WORDS = 18;
const MIN_THREE_LETTER_WORDS = 6;
const MIN_FOUR_PLUS_LETTER_WORDS = 8;
const CACHE_TTL_MS = 10 * 60 * 1000;
const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

const BUNDLED_DICTIONARY_PATH = fileURLToPath(
  new URL("../english-words.txt", import.meta.url),
);

const DICTIONARY_CANDIDATE_PATHS = [
  process.env.WORDPOT_DICTIONARY_PATH,
  BUNDLED_DICTIONARY_PATH,
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

const EMERGENCY_SOURCE_WORDS = [
  "CREATION",
  "LANGUAGE",
  "TREASURY",
  "REMITTANCE",
];

let lastSourceWord = "";
let cachedRounds = [];
let cacheExpiresAt = 0;
let dictionaryWords = [];
let isCacheRefilling = false;
let cacheRefillPromise = null;
const derivedWordsCache = new Map();

// ✅ FIX: Fisher-Yates shuffle (unbiased)
function shuffle(items) {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ✅ FIX: Validate dictionary load with error state
function loadDictionary() {
  if (dictionaryWords.length) return dictionaryWords;

  try {
    const dictionaryPath = DICTIONARY_CANDIDATE_PATHS.find((candidate) =>
      fs.existsSync(candidate),
    );

    if (!dictionaryPath) {
      throw new Error("No dictionary file found on the server.");
    }

    const raw = fs.readFileSync(dictionaryPath, "utf8");
    dictionaryWords = uniqueWords(
      raw
        .split(/\r?\n/)
        .map((word) =>
          String(word || "")
            .trim()
            .toLowerCase(),
        )
        .filter((word) => /^[a-z]+$/.test(word))
        .filter((word) => word.length >= 3 && word.length <= 12),
    ).sort();

    if (!dictionaryWords.length) {
      throw new Error("Dictionary loaded but contains no valid words.");
    }

    console.info(
      `Dictionary loaded: ${dictionaryWords.length} words from ${dictionaryPath}`,
    );
  } catch (error) {
    console.error(`Unable to load WordPot dictionary: ${error.message}`);
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
  const normalizedSource = String(sourceWord || "")
    .trim()
    .toLowerCase();

  if (!normalizedSource) {
    console.warn("deriveValidWords called with empty sourceWord");
    return [];
  }

  if (derivedWordsCache.has(normalizedSource)) {
    return derivedWordsCache.get(normalizedSource);
  }

  const dictionary = loadDictionary();
  if (!dictionary.length) {
    console.error("Cannot derive words: dictionary is empty");
    return [];
  }

  const validWords = uniqueWords(
    dictionary.filter(
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
  const normalized = String(word || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;

  const dictionary = loadDictionary();
  if (!dictionary.length) return false;

  return dictionary.includes(normalized);
}

function makeRound(sourceWord) {
  return {
    sourceWord,
    validWords: deriveValidWords(sourceWord),
  };
}

function isPlayableRound(round) {
  const threeLetterWords = round.validWords.filter(
    (word) => word.length === 3,
  ).length;
  const fourPlusLetterWords = round.validWords.filter(
    (word) => word.length >= 4,
  ).length;

  return (
    round.validWords.length >= MIN_VALID_WORDS &&
    threeLetterWords >= MIN_THREE_LETTER_WORDS &&
    fourPlusLetterWords >= MIN_FOUR_PLUS_LETTER_WORDS
  );
}

function getFallbackRounds() {
  const dictionary = loadDictionary();

  if (!dictionary.length) {
    console.warn("Dictionary empty; using SOURCE_WORD_POOL fallback");
    return SOURCE_WORD_POOL.map(makeRound).filter(isPlayableRound);
  }

  const dictionaryRounds = shuffle(
    dictionary.filter(
      (word) =>
        word.length >= 8 && word.length <= 12 && new Set(word).size >= 5,
    ),
  )
    .slice(0, 250)
    .map((word) => word.toUpperCase())
    .map(makeRound)
    .filter(isPlayableRound);

  if (dictionaryRounds.length) {
    return dictionaryRounds;
  }

  return SOURCE_WORD_POOL.map(makeRound).filter(isPlayableRound);
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

  const candidates = rounds.filter(
    (round) => round.sourceWord !== lastSourceWord,
  );
  const pool = candidates.length ? candidates : rounds;
  const nextRound = pool[Math.floor(Math.random() * pool.length)];
  lastSourceWord = nextRound.sourceWord;
  return nextRound;
}

// ✅ FIX: Add timeout to API calls
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchDatamuseCandidates() {
  const patterns = [9, 10, 11, 12].map((length) => "?".repeat(length));

  const responses = await Promise.all(
    patterns.map(async (pattern) => {
      const url = new URL(DATAMUSE_API_URL);
      url.searchParams.set("sp", pattern);
      url.searchParams.set("max", "40");

      const response = await fetchWithTimeout(url, API_TIMEOUT_MS);
      if (!response.ok) {
        throw new Error(
          `Datamuse returned ${response.status} for pattern ${pattern}`,
        );
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

// ✅ FIX: Prevent race conditions with promise deduplication
async function refillRoundCache() {
  // If already refilling, wait for the existing promise
  if (isCacheRefilling) {
    return cacheRefillPromise;
  }

  isCacheRefilling = true;

  cacheRefillPromise = (async () => {
    let retries = 0;

    while (retries <= MAX_RETRIES) {
      try {
        const remoteSourceWords = await fetchDatamuseCandidates();
        const remoteRounds = uniqueWords(remoteSourceWords)
          .map(makeRound)
          .filter(isPlayableRound);

        if (remoteRounds.length) {
          cachedRounds = remoteRounds;
          cacheExpiresAt = Date.now() + CACHE_TTL_MS;
          console.info(
            `Cache refilled: ${remoteRounds.length} rounds from API`,
          );
          return;
        }

        retries++;
      } catch (error) {
        console.warn(
          `API fetch attempt ${retries + 1}/${MAX_RETRIES + 1} failed: ${error.message}`,
        );
        retries++;

        if (retries <= MAX_RETRIES) {
          // Exponential backoff before retry
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retries) * 500),
          );
        }
      }
    }

    // Fallback chain
    console.warn("All API retries exhausted; using fallback rounds");
    cachedRounds = getFallbackRounds();

    if (!cachedRounds.length) {
      console.warn("Fallback pool exhausted; using EMERGENCY_SOURCE_WORDS");
      cachedRounds =
        EMERGENCY_SOURCE_WORDS.map(makeRound).filter(isPlayableRound);
    }

    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  })();

  try {
    await cacheRefillPromise;
  } finally {
    isCacheRefilling = false;
  }
}

export async function getDynamicRound() {
  const isCacheValid = cachedRounds.length > 0 && Date.now() <= cacheExpiresAt;

  if (!isCacheValid) {
    await refillRoundCache();
  }

  return pickFromRounds(cachedRounds);
}
