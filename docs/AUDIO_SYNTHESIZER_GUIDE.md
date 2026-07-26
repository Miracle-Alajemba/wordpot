# Web Audio Synthesizer Technical Specification

WordPot incorporates a zero-dependency synthesized audio engine built on the browser-native Web Audio API (`AudioContext`, `OscillatorNode`, and `GainNode`).

## Architecture & Frequency Map

Synthesized sound effects generate custom audio frequencies on-the-fly without needing external `.mp3` or `.wav` asset downloads.

| Event | Waveform | Frequencies (Hz) | Duration | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Success Chime** | `sine` | 523.25Hz (C5) -> 659.25Hz (E5) | 150ms | Triggered on valid word submission |
| **Error Buzzer** | `sawtooth` | 180Hz | 200ms | Triggered on invalid/duplicate word |
| **Combo 2x** | `triangle` | 550Hz -> 660Hz | 180ms | Triggered on 2x combo streak |
| **Combo 3x** | `triangle` | 660Hz -> 792Hz | 180ms | Triggered on 3x combo streak |
| **Combo 5x** | `triangle` | 880Hz -> 1056Hz | 180ms | Triggered on 5x combo streak |
| **Victory Fanfare**| `sine` | 523.25 -> 659.25 -> 783.99 -> 1046.5Hz | 400ms | Triggered on daily challenge claim victory |

## Client Usage

```javascript
import { audioFx } from "../utils/audio-fx.js";

// Play success chime
audioFx.playSuccessChime();

// Play error buzzer
audioFx.playErrorBuzzer();

// Play 3x combo chime
audioFx.playComboChime(3);

// Mute/Unmute toggle
const isMuted = audioFx.toggleMute();
```

## SoundIndicator Component

The `SoundIndicator` UI component (`client/src/components/ui/sound-indicator.jsx`) provides an accessible mute toggle button for placement in screen headers.
