# Client Helper Utilities Specification

WordPot provides utility modules in `client/src/utils/` for data manipulation, formatting, and DOM helpers.

## Utilities Index

### Score & Number Formatting (`score-formatter.js`)
* `formatScoreCompact(score)`: Formats numeric scores into compact strings (`1250` -> `"1.3k"`).
* `formatRankOrdinal(rank)`: Formats numeric ranks into ordinal strings (`1` -> `"1st"`).

### Address & EVM Helpers (`address-truncator.js`)
* `truncateAddress(address, start, end)`: Truncates EVM wallet addresses (`"0x1234...abcd"`).
* `isValidEvmAddress(address)`: Returns boolean indicating if input string is a valid EVM wallet address.

### Audio & Sound Synthesizer (`audio-fx.js`)
* `audioFx.playSuccessChime()`: Triggers synthesized success chime.
* `audioFx.playErrorBuzzer()`: Triggers synthesized error buzzer tone.
* `audioFx.playComboChime(multiplier)`: Triggers combo multiplier chime.
* `audioFx.toggleMute()`: Toggles master sound mute state.
