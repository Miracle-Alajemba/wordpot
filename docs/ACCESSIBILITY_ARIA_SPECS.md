# Accessibility & ARIA Specifications

WordPot is designed to adhere to WCAG 2.1 AA accessibility standards across all components and user flows.

## ARIA Guidelines

1. **Modal Dialogs**: All modals (`Modal`, `UsernameModal`, `KeyboardShortcutsModal`) use `role="dialog"`, `aria-modal="true"`, `aria-label`, and focus traps with ESC key listeners.
2. **Interactive Elements**: Custom switches use `role="switch"` and `aria-checked`. Dropdowns use `role="listbox"` and `aria-selected`.
3. **Live Regions**: Live scores and active turn updates use `aria-live="polite"` or `aria-live="assertive"`.
4. **Icons**: Decorative emojis and icons are marked `aria-hidden="true"`, with parent wrappers containing explicit descriptive labels.
5. **Keyboard Navigation**: Full focus ring indicators with customizable outline tokens.
