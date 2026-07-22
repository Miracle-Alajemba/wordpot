# WordPot UI Design System & Styling Tokens

WordPot features a vibrant, mobile-first Web3 design system defined in `client/src/styles.css`.

## Core Palette & CSS Variables

```css
:root {
  --bg-dark: #0f172a;
  --bg-card: rgba(30, 41, 59, 0.7);
  --primary-accent: #38bdf8;
  --primary-glow: rgba(56, 189, 248, 0.25);
  --success-green: #22c55e;
  --warning-amber: #f59e0b;
  --danger-red: #ef4444;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --border-glass: rgba(255, 255, 255, 0.1);
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
}
```

## Aesthetic Principles

1. **Glassmorphism**: Backdrop blur filter (`backdrop-filter: blur(12px)`) layered over deep slate background gradients (`#0f172a` to `#1e1b4b`).
2. **Interactive Micro-Animations**:
   * Letter tile hover/press scaling (`transform: scale(1.05)`).
   * Shimmer effects on CTA primary action buttons.
   * Score pop-up animation on valid word submission (`+5` indicator floating up).
3. **Typography**: Clean sans-serif font family hierarchy optimized for high legibility on mobile screens (Inter / System UI).

## Component Tokens

| Component | Class | Key Style Properties |
| :--- | :--- | :--- |
| **Glass Card** | `.glass-card` | `background: var(--bg-card); border: 1px solid var(--border-glass)` |
| **Primary Button**| `.btn-primary` | `background: linear-gradient(135deg, #38bdf8, #3b82f6)` |
| **Letter Tile** | `.tile` | `font-weight: 700; width: 44px; height: 44px; display: flex; align-items: center` |
| **Timer Badge** | `.timer-badge` | `background: rgba(245, 158, 11, 0.15); color: #fbbf24` |
