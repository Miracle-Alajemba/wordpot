# Word Validation Engine & Dictionary Parsing Specifications

WordPot uses a memory-efficient word dictionary engine backed by `server/english-words.txt` to deliver instant, zero-latency word validation.

## Dictionary File Structure

* **File Location**: `server/english-words.txt`
* **Size**: ~985 KB containing over 100,000 valid English words.
* **Format**: Plaintext UTF-8, newline-separated uppercase words.

## Validation Pipeline

```
[User Submits Word] ---> [Length Check (>= 3)] ---> [Anagram Subset Check] ---> [Dictionary Set Lookup]
                                                                                        |
                                                                                        v
[Score Added & Stored] <----------------- [Check Duplicate Submission] <----------- [Valid]
```

## Sub-Word Anagram Logic

To be valid, a submitted word must be constructable using **only** the character frequencies available in the active room's `sourceWord`.

```javascript
function canFormWord(candidateWord, sourceWord) {
  const sourceFreq = getCharFrequency(sourceWord);
  const candidateFreq = getCharFrequency(candidateWord);

  for (const char in candidateFreq) {
    if ((sourceFreq[char] || 0) < candidateFreq[char]) {
      return false;
    }
  }
  return true;
}
```

## Source Word Generator

Source words are dynamically selected from a curated list of 7 to 9 letter words with high vowel density to guarantee at least 25+ possible valid sub-words per round.
