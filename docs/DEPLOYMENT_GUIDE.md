# WordPot Production Deployment Guide

## Overview

This guide details the deployment steps for WordPot on **Vercel** (Frontend) and **Railway** (Backend API).

---

## 1. Frontend (Vercel)

- **Framework**: Vite + React
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://wordpot-production.up.railway.app/api`
  - `VITE_REOWN_PROJECT_ID`: Reown AppKit Project ID

---

## 2. Backend API (Railway)

- **Runtime**: Node.js + Express
- **Start Command**: `npm start`
- **Environment Variables**:
  - `TREASURY_WALLET`: Celo Treasury Receiver EVM Address
  - `WORDPOT_CONTRACT_ADDRESS`: `0x4302D510383C6be4a284759BB0616fc6ED57e9A1`
  - `CONTRACT_OPERATOR_PRIVATE_KEY`: Private key for settlement calls
  - `CELO_CHAIN_ID`: `42220`
