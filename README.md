# WordCourt

> Every word has to stand in court.

WordCourt is a multiplayer Scrabble-style word game. **Supabase** powers rooms, realtime
play, private racks, chat, and profiles. **GenLayer** acts as the trusted referee for board
state, word validation, scoring, challenges, disputes, and final match settlement.

WordCourt uses Supabase for realtime coordination, rooms, profiles, chat, private racks,
tile services, and cached UI state. GenLayer remains the **authoritative referee** for public
board state, word validation, scoring, challenges, disputes, and final settlement. Supabase
never decides the official board, official score, or winner. **If Supabase and GenLayer
disagree, GenLayer is the source of truth.**

## Architecture

```
User / Browser
  -> Next.js frontend          (experience: drag tiles, preview, animations)
  -> Wallet-signed GenLayer calls
  -> GenLayer Intelligent Contract  (truth: board, scores, moves, challenges, winner)

User / Browser
  -> Supabase                  (realtime app layer: rooms, chat, profiles, private racks)
```

## Monorepo layout

```
wordcourt/
  apps/web/            Next.js 15 app (App Router, TS, Tailwind)
  contracts/genlayer/  GenLayer Intelligent Contract (Python) + deploy tooling
  packages/shared/     Shared TS types, tile/board/colour constants
  supabase/            SQL migrations + Edge Functions
  scripts/             Dev/ops scripts
  docs/                Architecture & integration docs
  tests/               Unit + integration tests
  e2e/                 Playwright end-to-end tests
  infra/               CI/infra config
```

## Tech stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Framer Motion, TanStack Query,
  Zustand, wagmi, viem, RainbowKit, Lucide React.
- **Backend:** Supabase Postgres, Realtime, Row Level Security, Edge Functions.
- **Blockchain:** GenLayer Python Intelligent Contract (py-genlayer), wallet-signed calls,
  deployed to GenLayer StudioNet (no Docker).

## Prerequisites

- Node.js >= 22, pnpm >= 11
- Python 3.12 (`py -3.12` on Windows) for GenLayer contract tooling
- A Supabase project, a WalletConnect project id, and a GenLayer StudioNet account

## Getting started

```powershell
pnpm install
copy .env.example .env
# fill in .env, then copy the web-facing values into apps/web/.env.local
pnpm dev
```

## Status

Built incrementally, phase by phase. See `docs/` for per-phase notes.
