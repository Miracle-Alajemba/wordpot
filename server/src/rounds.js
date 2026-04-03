const DATAMUSE_API_URL = "https://api.datamuse.com/words";
const MIN_VALID_WORDS = 10;
const CACHE_TTL_MS = 10 * 60 * 1000;

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

const WORD_BANK = [
  "ant","art","atom","back","bach","bail","ball","bank","base","beam","boat","bolt","bond",
  "block","black","brain","brand","care","cart","cat","chain","chalk","chat","chin","city",
  "clan","clock","clot","coal","coat","coin","comic","common","count","county","crane",
  "crate","create","cut","dance","dream","earn","east","eastern","educate","enter","equal",
  "fair","field","form","frame","found","game","gate","grain","grant","hail","hall","halt",
  "hat","hint","house","icon","into","kick","land","lane","language","learn","line","link",
  "loan","lock","long","loom","main","mail","mare","market","mate","mean","meat","mint",
  "mission","mono","moon","mount","mouth","move","name","near","night","note","omit","pace",
  "path","platform","plant","point","pool","port","rate","react","real","reason","remain",
  "rent","rice","road","scar","score","steam","stare","stable","story","stone","teach",
  "team","term","thank","thin","tone","tonic","touch","tour","trace","train","treat","trend",
  "trim","unit","unity","unto","value","vault","vote","word","world",
];

let lastSourceWord = "";
let cachedRounds = [];
let cacheExpiresAt = 0;

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
  return uniqueWords(
    WORD_BANK.filter(
      (word) =>
        word.length >= 3 &&
        word.length <= sourceWord.length &&
        canBuildFromSource(word, sourceWord),
    ),
  ).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
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
  return SOURCE_WORD_POOL
    .map(makeRound)
    .filter(isPlayableRound);
}

function pickFromRounds(rounds) {
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
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export async function getDynamicRound() {
  if (!cachedRounds.length || Date.now() > cacheExpiresAt) {
    await refillRoundCache();
  }

  return pickFromRounds(cachedRounds);
}
