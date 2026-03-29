export const PRACTICE_ROUNDS = [
  {
    sourceWord: "BLOCKCHAIN",
    validWords: [
      "back",
      "bach",
      "bail",
      "ball",
      "bank",
      "bin",
      "black",
      "block",
      "blot",
      "boat",
      "bolt",
      "chain",
      "chalk",
      "chat",
      "chin",
      "clan",
      "clock",
      "clot",
      "coal",
      "coat",
      "coin",
      "cold",
      "hail",
      "hall",
      "halt",
      "hat",
      "hint",
      "into",
      "kick",
      "lain",
      "land",
      "lack",
      "loan",
      "lock",
      "loin",
      "lot",
      "mail",
      "main",
      "mall",
      "mint",
      "nail",
      "night",
      "path",
      "thin",
      "thank",
      "tonic",
      "tail",
      "tank",
      "talk",
    ],
  },
  {
    sourceWord: "REMITTANCE",
    validWords: [
      "ant",
      "art",
      "care",
      "cart",
      "cat",
      "cement",
      "certain",
      "crate",
      "crane",
      "earn",
      "eastern",
      "enter",
      "mare",
      "meat",
      "mint",
      "name",
      "near",
      "rate",
      "react",
      "remain",
      "rent",
      "rice",
      "scar",
      "steam",
      "stare",
      "team",
      "term",
      "trace",
      "train",
      "treat",
    ],
  },
  {
    sourceWord: "COMMUNITY",
    validWords: [
      "coin",
      "comic",
      "commute",
      "count",
      "county",
      "cut",
      "mint",
      "mono",
      "moon",
      "mount",
      "mouth",
      "unity",
      "unto",
      "tiny",
      "tonic",
      "touch",
      "tour",
      "trim",
      "tunic",
      "unit",
      "count",
      "omit",
      "icon",
      "city",
    ],
  },
];

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

export function getWordScore(word) {
  if (word.length >= 6) return 12;
  if (word.length === 5) return 8;
  if (word.length === 4) return 5;
  return 3;
}

export function normalizeWord(value) {
  return value.trim().toLowerCase();
}

export function pickPracticeRound() {
  const index = Math.floor(Math.random() * PRACTICE_ROUNDS.length);
  return PRACTICE_ROUNDS[index];
}

