// Web Audio API Ambient Background Music Synthesizer

let audioCtx = null;
let bgOscillators = [];
let bgGainNode = null;
let isMusicPlaying = false;
let loopInterval = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Chill Lo-Fi Chords & Bass Sequences
const CHORDS = [
  { bass: 130.81, treble: [261.63, 329.63, 392.0, 493.88] }, // C3 + C4/E4/G4/B4
  { bass: 110.0,  treble: [220.0, 261.63, 329.63, 392.0] },  // A2 + A3/C4/E4/G4
  { bass: 87.31,  treble: [174.61, 220.0, 261.63, 329.63] }, // F2 + F3/A3/C4/E4
  { bass: 98.0,   treble: [196.0, 246.94, 293.66, 349.23] }, // G2 + G3/B3/D4/F4
];

let chordIndex = 0;

function playChord(chordData) {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPlaying) return;

  // Clear past oscillator references
  bgOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  bgOscillators = [];

  const now = ctx.currentTime;
  const destination = bgGainNode || ctx.destination;

  // 1. Warm Bass Synth Line
  try {
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();

    bassOsc.type = "triangle";
    bassOsc.frequency.setValueAtTime(chordData.bass, now);

    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.linearRampToValueAtTime(0.18, now + 0.4);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

    bassOsc.connect(bassGain);
    bassGain.connect(destination);

    bassOsc.start(now);
    bassOsc.stop(now + 3.5);

    bgOscillators.push(bassOsc);
  } catch {}

  // 2. Treble Chord Voices (Soft Sine Swell)
  chordData.treble.forEach((freq, idx) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const delay = idx * 0.08; // Staggered arpeggio entry

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 3.2);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(now + delay);
      osc.stop(now + delay + 3.3);

      bgOscillators.push(osc);
    } catch {}
  });
}

export function startBackgroundMusic() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  if (isMusicPlaying) return;
  isMusicPlaying = true;

  if (!bgGainNode) {
    bgGainNode = ctx.createGain();
    bgGainNode.gain.setValueAtTime(0.85, ctx.currentTime);
    bgGainNode.connect(ctx.destination);
  }

  playChord(CHORDS[chordIndex]);
  chordIndex = (chordIndex + 1) % CHORDS.length;

  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(() => {
    if (!isMusicPlaying) return;
    playChord(CHORDS[chordIndex]);
    chordIndex = (chordIndex + 1) % CHORDS.length;
  }, 3500);
}

export function stopBackgroundMusic() {
  isMusicPlaying = false;
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  bgOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  bgOscillators = [];
}

export function toggleBackgroundMusic() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  if (isMusicPlaying) {
    stopBackgroundMusic();
    return false;
  } else {
    startBackgroundMusic();
    return true;
  }
}

export function isMusicActive() {
  return isMusicPlaying;
}
