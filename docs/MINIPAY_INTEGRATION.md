# Opera MiniPay Integration Specification

WordPot provides native integration with Opera MiniPay on Celo Mainnet.

## Key Features
- **In-App Provider Detection**: Automatic resolution of `window.ethereum`, `window.celo`, or `window.web3`.
- **Gas Fee Optimization**: Transactions configured with minimal gas bounds for instant mobile confirmation.
- **Deep Linking**: Direct wallet trigger via custom URI schema.
