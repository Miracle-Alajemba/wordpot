# Client Custom Hooks Reference Guide

WordPot includes custom React hooks in `client/src/hooks/` to streamline state management, UI events, and responsiveness.

## Hooks Index

### DOM & Document State
* `useDocumentTitle(title, resetOnUnmount)`: Dynamically sets document title with optional unmount cleanup.
* `useKeyboardShortcut(key, handler, options)`: Listens for key combinations (`Enter`, `Escape`, `Ctrl+Key`).
* `useIntervalTimer(callback, delay)`: Declarative wrapper for `setInterval`.

### Responsive & Layout Tracking
* `useMediaQuery(query)`: Listens for CSS media queries (e.g. `(max-width: 768px)`).
* `useOnScreen(ref)`: Intersection Observer hook tracking component viewport visibility.
* `usePrevious(value)`: Tracks state value from preceding render cycle.

### Application State & Storage
* `useWalletSession()`: Celo / MiniPay wallet connection and session manager.
* `useLocalStorage(key, initialValue)`: Synchronizes state with browser `localStorage`.
* `useClipboard()`: Handles copy-to-clipboard actions with fallback support.
* `useCountdown(seconds)`: Timer countdown hook for game rounds.
