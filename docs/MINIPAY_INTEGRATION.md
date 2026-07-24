# Opera MiniPay Integration Specification

## Overview

WordPot is specifically designed for mobile users inside Opera MiniPay in emerging markets across Africa (Nigeria, Kenya, Ghana, Uganda).

---

## Technical Integration Rules

1. **Injected Provider Detection**: MiniPay injects an Ethereum-compatible Web3 provider (`window.ethereum`).
2. **Fast Micro-Transactions**: All transactions run on Celo Mainnet with sub-second finality and near-zero gas costs (~$0.001 per transaction).
3. **No Pop-up Modals**: UI uses automatic fallback signature requests matching MiniPay UX guidelines.
4. **Daily Challenge Claim**: Daily rewards send `0.01 CELO` directly to user wallets on MiniPay once daily challenge target scores are reached.
