# Security & Secret Management Specification

## Security Measures
- **Environment Isolation**: Private keys are strictly read via `process.env` and never hardcoded in source code or committed to git repository.
- **Session HMAC Signature**: Session tokens signed with HMAC-SHA256 and verified using constant-time comparison (`crypto.timingSafeEqual`).
- **Input Sanitization**: All incoming player words and handles sanitized against XSS and control character injection.
