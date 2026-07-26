# Modular UI Component System Guide

WordPot provides a modular component architecture (`client/src/components/ui/`) tailored for low-latency Web3 mini-games and responsive desktop/mobile layouts.

## Component Index

### Sound & Audio Feedback
* `SoundIndicator`: Accessible mute/unmute toggle button with visual state.
* `VolumeSlider`: Audio volume range controller.
* `AudioToggle`: Quick sound FX mute trigger.

### Player Identity & Rankings
* `LeaderboardAvatar`: Deterministic color avatar derived from EVM wallet address with rank badge overlay.
* `PlayerCard`: Player summary row displaying handle, shortened wallet address, host indicator, and score.
* `LeaderboardRow`: Individual leaderboard rank item with tier highlight.

### Game Micro-Interactions & Combo Badges
* `StreakFlame`: Animated daily play streak counter badge.
* `ScoreMultiplierTag`: Animated 2x / 3x / 5x score booster indicator.
* `ComboCounter`: Live word combination multiplier pill.

### Notifications & Tooltips
* `NotificationBanner`: Contextual alert banner with variant themes (`info`, `success`, `warning`, `error`).
* `TooltipBox`: Accessible hover and focus tooltip overlay.
* `Toast`: Auto-dismissing transient game alert.
