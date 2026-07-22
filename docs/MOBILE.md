# Mobile UX & MiniPay Integration Specifications

WordPot is engineered mobile-first to target smartphone users across Africa utilizing Opera MiniPay and Celo mobile wallets.

## Opera MiniPay Integration Highlights

1. **Auto Wallet Connection**: Leverages MiniPay's injected window provider (`window.ethereum` or `window.celo`) for zero-click wallet detection on webview load.
2. **Instant Gas Subsidies**: Interacts with Celo gas fee mechanics, enabling seamless transaction prompts within the Opera SuperApp environment.
3. **Deep Linking**: Supports direct room joining links shared over mobile messaging apps (WhatsApp, Telegram).

---

## Responsive Layout Rules

* **Touch Targets**: Minimum interactive element size set to `44px x 44px` with `8px` touch padding.
* **Viewport Lock**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ```
* **Keyboard Management**: Adapts letter tile grids dynamically when soft keyboards deploy during mobile gameplay.
