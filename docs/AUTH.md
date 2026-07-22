# Wallet Authentication and Session Protocol

WordPot uses non-custodial wallet authentication for identifying players, securing room access, and verifying reward payout eligibility.

## Authentication Overview

```
+---------------+              +--------------------+              +----------------+
|  User Wallet  |              |  WordPot Frontend  |              | Express Server |
+-------+-------+              +---------+----------+              +-------+--------+
        |                                |                                 |
        |  1. Injected Provider Detected |                                 |
        |<-------------------------------+                                 |
        |  2. Connect & Return Address   |                                 |
        |+------------------------------>|                                 |
        |                                |  3. Register Session (Address)  |
        |                                |+------------------------------->|
        |                                |  4. Session Token / Room Auth   |
        |                                |<--------------------------------+
```

## Key Mechanisms

### 1. Injected Provider Detection
The client detects injected Ethereum/Celo wallet providers (`window.ethereum` or `window.celo` for MiniPay).
* **MiniPay Auto-Connect**: When loaded inside the Opera MiniPay browser, the application automatically requests account access without requiring manual button triggers.
* **Standard Injected**: Fallbacks to standard EVM injected connectors via `viem` / `wagmi`.

### 2. Address Verification
* Wallet addresses are normalized to lower-case checksummed hex strings (`0x...`).
* Player identity in room lobbies is anchored to their verified wallet address.

### 3. Signed Message Verification (Daily Challenge)
To prevent score spoofing or bot replay attacks, daily challenge claims require a signed payload:
```javascript
const message = `WordPot Daily Claim\nWallet: ${walletAddress}\nDate: ${currentDate}\nScore: ${score}`;
const signature = await walletClient.signMessage({ account: walletAddress, message });
```
The backend verifies `signature` via `viem.verifyMessage` before triggering the contract operator payout.
