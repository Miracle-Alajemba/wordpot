// Web Audio API Upbeat Arcade Game Melody Synthesizer

let audioCtx = null;
let bgOscillators = [];
let bgGainNode = null;
let isMusicPlaying = false;
let melodyInterval = null;

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

// Upbeat Arcade Game Melody Notes (BPM 130)
// Frequencies for C4, E4, G4, A4, C5, B4, G4, E4, D4, F4, A4, C5
const ARCADE_MELODY = [
  { note: 523.25, duration: 0.2 }, // C5
  { note: 659.25, duration: 0.2 }, // E5
  { note: 783.99, duration: 0.2 }, // G5
  { note: 880.0,  duration: 0.2 }, // A5
  { note: 783.99, duration: 0.2 }, // G5
  { note: 659.25, duration: 0.2 }, // E5
  { note: 523.25, duration: 0.4 }, // C5
  { note: 587.33, duration: 0.2 }, // D5
  { note: 698.46, duration: 0.2 }, // F5
  { note: 880.0,  duration: 0.2 }, // A5
  { note: 1046.5, duration: 0.4 }, // C6
  { note: 783.99, duration: 0.4 }, // G5
];

const BASS_LINE = [261.63, 220.0, 174.61, 196.0]; // C4, A3, F3, G3
let noteIdx = 0;

function playMelodyStep() {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPlaying) return;

  const step = ARCADE_MELODY[noteIdx % ARCADE_MELODY.length];
  const bassFreq = BASS_LINE[Math.floor(noteIdx / 3) % BASS_LINE.length];
  const now = ctx.currentTime;
  const destination = bgGainNode || ctx.destination;

  // Lead Melody (Square wave for retro game feel)
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(step.note, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + step.duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(now);
    osc.stop(now + step.duration);

    bgOscillators.push(osc);
  } catch {}

  // Bouncy Bass (Sine wave)
  if (noteIdx % 3 === 0) {
    try {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bassOsc.type = "sine";
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassGain.gain.setValueAtTime(0.15, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      bassOsc.connect(bassGain);
      bassGain.connect(destination);

      bassOsc.start(now);
      bassOsc.stop(now + 0.4);

      bgOscillators.push(bassOsc);
    } catch {}
  }

  noteIdx++;
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
    bgGainNode.gain.setValueAtTime(0.7, ctx.currentTime);
    bgGainNode.connect(ctx.destination);
  }

  noteIdx = 0;
  playMelodyStep();

  if (melodyInterval) clearInterval(melodyInterval);
  melodyInterval = setInterval(() => {
    if (!isMusicPlaying) return;
    playMelodyStep();
  }, 230); // ~130 BPM bouncy rhythm
}

export function stopBackgroundMusic() {
  isMusicPlaying = false;
  if (melodyInterval) {
    clearInterval(melodyInterval);
    melodyInterval = null;
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
