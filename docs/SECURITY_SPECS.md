# Server Security Specifications

WordPot enforces input sanitization and HMAC signature verification across all player HTTP endpoints and Socket.IO events.

## Features

1. **HTML Escaping**: All player handles and strings are sanitized via `escapeHtml()` in `server/src/utils/security-helper.js`.
2. **Wallet Signatures**: Actions (joining room, claiming rewards, starting rounds) require EIP-712 / personal message signatures verified via `viem`.
3. **Session Tokens**: Deterministic HMAC tokens prevent request forgery across player sessions.
