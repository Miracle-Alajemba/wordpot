# Client and Server Error Handling Architecture

WordPot provides grace error degradation, user feedback toasts, and automatic state recovery mechanisms.

## Error Recovery Strategies

### 1. React UI Error Boundaries
React functional components are wrapped in Error Boundaries to trap unhandled rendering exceptions without crashing the full application.
* **Fallback View**: Renders a clean "Session Error" card with a **Reload Match** recovery button.

### 2. Blockchain Transaction Reverts
Contract calls are wrapped in try-catch blocks with explicit user notification parsing:

| Custom Error / Condition | User Toast Message |
| :--- | :--- |
| `InsufficientPayment()` | "Transaction fee does not match entry fee requirement." |
| `RoomNotActive()` | "This room lobby has expired or already settled." |
| `AlreadyJoined()` | "Your wallet is already registered in this room." |
| `UserRejected()` | "Transaction signature cancelled by user." |

### 3. Server HTTP Error Standards

```json
{
  "error": {
    "code": "WORD_INVALID_CHARACTERS",
    "message": "Submitted word contains letters not in source word.",
    "timestamp": 1784768450
  }
}
```
