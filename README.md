# ⚡ Solana Web Wallet

A browser-based Solana wallet built with **React + TypeScript**. Generate or import BIP-39 mnemonics, derive HD accounts via SLIP-10, check balances, request devnet airdrops, and send SOL — all from a single-page app.

> **⚠️ Demo only** — private keys are handled in the browser. Do **not** use with mainnet funds you can't afford to lose.

---

## Features

| Feature | Description |
|---------|-------------|
| **Mnemonic generation** | 12-word or 24-word BIP-39 mnemonic with show/hide toggle |
| **Mnemonic import** | In-page modal — no more browser `prompt()` |
| **HD account derivation** | SLIP-10 / Ed25519 path `m/44'/501'/<index>'/0'` |
| **Balance check** | Real-time SOL balance from any Solana cluster |
| **Airdrop** | 1 SOL devnet airdrop with one click |
| **Send SOL** | Transfer SOL to any public key |
| **Network selector** | Switch between Devnet, Testnet, Mainnet Beta |

---

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — dev server & bundler
- **@solana/web3.js** — Solana RPC & transactions
- **bip39** — mnemonic generation & validation
- **@noble/hashes** — HMAC-SHA512 for SLIP-10 derivation
- **buffer** — Node.js Buffer polyfill for the browser

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build
```

---

## Project Structure

```
web3-wallet/
├── index.html            # HTML entry point
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript config
├── vite.config.js        # Vite config
├── ARCHITECTURE.md       # Detailed file-by-file breakdown
└── src/
    ├── main.tsx          # React entry — mounts <App />
    ├── App.tsx           # Main wallet component (all UI + logic)
    ├── ed25519Slip10.ts  # SLIP-10 HD key derivation
    ├── index.css         # Global styles (glassmorphism dark theme)
    └── vite-env.d.ts     # TypeScript ambient declarations
```

## How It Works (High Level)

```
Mnemonic (12/24 words)
    │
    ▼
BIP-39 seed (512-bit)
    │
    ▼
SLIP-10 derivation  ──►  m/44'/501'/<index>'/0'
    │
    ▼
Ed25519 private key (32 bytes)
    │
    ▼
Solana Keypair  ──►  Public Key + Sign Transactions
```

---

## License

MIT

---

Built by **YashGaikwad**
