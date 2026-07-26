# Production Deployment Guide for Vercel & Railway

WordPot consists of a React client hosted on **Vercel** and an Express backend running on **Railway**.

## Vercel Frontend Deployment

1. Connect GitHub repository `Miracle-Alajemba/wordpot` to Vercel.
2. Set Root Directory: `client`
3. Framework Preset: `Vite`
4. Set Environment Variables:
   * `VITE_SERVER_URL`: URL of deployed Railway backend.

## Railway Backend Deployment

1. Connect GitHub repository `Miracle-Alajemba/wordpot` to Railway.
2. Set Root Directory: `server`
3. Set Environment Variables:
   * `PORT`: `4000`
   * `WORDPOT_CONTRACT_ADDRESS`: `0x4302D510383C6be4a284759BB0616fc6ED57e9A1`
   * `TREASURY_WALLET`: EVM wallet address for 10% room fee splits.
