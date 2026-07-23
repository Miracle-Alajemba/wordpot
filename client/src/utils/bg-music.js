// Catchy American Funk / Pop Hit Soundtrack Synthesizer (Upbeat Funk Groove)

let audioCtx = null;
let bgOscillators = [];
let bgGainNode = null;
let isMusicPlaying = false;
let grooveInterval = null;

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

// Iconic American Funk/Pop Hit Pattern (118 BPM Funk Groove in D Minor)
// Slap Bass notes + Staccato Brass Chords
const FUNK_BASS_PATTERN = [
  { freq: 146.83, duration: 0.18 }, // D3
  { freq: 146.83, duration: 0.12 }, // D3
  { freq: 174.61, duration: 0.18 }, // F3
  { freq: 196.0,  duration: 0.22 }, // G3
  { freq: 220.0,  duration: 0.18 }, // A3
  { freq: 261.63, duration: 0.22 }, // C4
  { freq: 146.83, duration: 0.18 }, // D3
  { freq: 196.0,  duration: 0.18 }, // G3
];

const FUNK_BRASS_CHORDS = [
  [293.66, 349.23, 440.0, 523.25], // Dm7 (D4, F4, A4, C5)
  [392.0, 493.88, 587.33, 698.46],  // G7 (G4, B4, D5, F5)
  [293.66, 349.23, 440.0, 523.25], // Dm7
  [349.23, 440.0, 523.25, 659.25],  // Fmaj7 (F4, A4, C5, E5)
];

let stepIdx = 0;

function playFunkStep() {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPlaying) return;

  const now = ctx.currentTime;
  const destination = bgGainNode || ctx.destination;
  const bassStep = FUNK_BASS_PATTERN[stepIdx % FUNK_BASS_PATTERN.length];

  // 1. Funky Slap Bass (Sawtooth + Low-pass punch)
  try {
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    bassOsc.type = "sawtooth";
    bassOsc.frequency.setValueAtTime(bassStep.freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + bassStep.duration);

    bassGain.gain.setValueAtTime(0.28, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + bassStep.duration);

    bassOsc.connect(filter);
    filter.connect(bassGain);
    bassGain.connect(destination);

    bassOsc.start(now);
    bassOsc.stop(now + bassStep.duration);

    bgOscillators.push(bassOsc);
  } catch {}

  // 2. Energetic Brass Chord Stabs (on syncopated beats)
  if (stepIdx % 2 === 1) {
    const chord = FUNK_BRASS_CHORDS[Math.floor(stepIdx / 2) % FUNK_BRASS_CHORDS.length];
    chord.forEach((freq) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(now);
        osc.stop(now + 0.18);

        bgOscillators.push(osc);
      } catch {}
    });
  }

  stepIdx++;
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
    bgGainNode.gain.setValueAtTime(0.9, ctx.currentTime);
    bgGainNode.connect(ctx.destination);
  }

  stepIdx = 0;
  playFunkStep();

  if (grooveInterval) clearInterval(grooveInterval);
  grooveInterval = setInterval(() => {
    if (!isMusicPlaying) return;
    playFunkStep();
  }, 250); // ~118 BPM upbeat funk rhythm
}

export function stopBackgroundMusic() {
  isMusicPlaying = false;
  if (grooveInterval) {
    clearInterval(grooveInterval);
    grooveInterval = null;
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
