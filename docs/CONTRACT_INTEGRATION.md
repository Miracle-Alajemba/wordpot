# Celo Smart Contract Integration Specification

WordPot interacts with Solidity smart contracts deployed on Celo Mainnet for entry fee escrow and daily reward distributions.

## Contract Addresses

* **Room Escrow Contract**: `0x764b3f8761CEB44e6FFA6480484b706C3c3A8284`
* **Daily Challenge Reward Contract**: `0x4302D510383C6be4a284759BB0616fc6ED57e9A1`

## Wallet Authentication

Players authenticate wallet transactions using EIP-712 typed data signatures or standard personal sign messages verified via `viem`:

```javascript
import { recoverMessageAddress } from "viem";

const recoveredAddress = await recoverMessageAddress({
  message: `WordPot Auth: ${walletAddress}`,
  signature,
});
```
