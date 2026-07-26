# Server Configuration Specification

WordPot server configuration is loaded from environment variables (`.env`) via `server/src/utils/config-loader.js`.

## Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | HTTP server listening port |
| `NODE_ENV` | `"development"` | Node.js execution environment mode |
| `TREASURY_WALLET` | `null` | EVM address receiving 10% room treasury split |
| `WORDPOT_CONTRACT_ADDRESS` | `0x4302D510383C6be4a284759BB0616fc6ED57e9A1` | Mainnet contract address for escrow rewards |
| `CELO_CHAIN_ID` | `42220` | Celo Mainnet EVM Chain ID |
| `JOIN_PAYMENT_DISPLAY` | `"0.01"` | Entry fee amount displayed in CELO |
| `DATABASE_URL` | `null` | PostgreSQL connection string |
| `DATABASE_SSL` | `false` | Enable SSL for remote PostgreSQL databases |
