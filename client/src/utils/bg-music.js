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
    audioCtx.resume();
  }
  return audioCtx;
}

// Ambient chord sequence (Cmaj9, Am9, Fmaj7, G6)
const AMBIENT_CHORDS = [
  [261.63, 329.63, 392.0, 493.88], // C4, E4, G4, B4
  [220.0, 261.63, 329.63, 392.0],  // A3, C4, E4, G4
  [174.61, 220.0, 261.63, 329.63], // F3, A3, C4, E4
  [196.0, 246.94, 293.66, 349.23], // G3, B3, D4, F4
];

let chordIndex = 0;

function playChord(notes) {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPlaying) return;

  // Stop previous note instances
  bgOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  });
  bgOscillators = [];

  notes.forEach((freq) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Soft swell envelope
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 1.2);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 3.8);

      osc.connect(gain);
      gain.connect(bgGainNode || ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 3.9);

      bgOscillators.push(osc);
    } catch {}
  });
}

export function startBackgroundMusic() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (isMusicPlaying) return;
  isMusicPlaying = true;

  if (!bgGainNode) {
    bgGainNode = ctx.createGain();
    bgGainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    bgGainNode.connect(ctx.destination);
  }

  // Play immediately and schedule chord loop every 4 seconds
  playChord(AMBIENT_CHORDS[chordIndex]);
  chordIndex = (chordIndex + 1) % AMBIENT_CHORDS.length;

  if (loopInterval) clearInterval(loopInterval);
  loopInterval = setInterval(() => {
    if (!isMusicPlaying) return;
    playChord(AMBIENT_CHORDS[chordIndex]);
    chordIndex = (chordIndex + 1) % AMBIENT_CHORDS.length;
  }, 4000);
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
