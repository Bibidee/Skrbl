# WordCourt — Recovery Status Report

Generated: 2026-05-27 18:36:12

---

## 1. Detected Folder Tree

```
├── apps
│   └── web
│       ├── app
│       │   ├── api
│       │   ├── game
│       │   ├── history
│       │   ├── leaderboard
│       │   ├── lobby
│       │   ├── profile
│       │   ├── error.tsx
│       │   ├── global-error.tsx
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── loading.tsx
│       │   ├── not-found.tsx
│       │   └── page.tsx
│       ├── components
│       │   ├── layout
│       │   ├── lobby
│       │   ├── providers
│       │   ├── scrabble
│       │   ├── ui
│       │   └── wallet
│       ├── hooks
│       │   └── useWalletAuth.ts
│       ├── lib
│       │   ├── analytics
│       │   ├── auth
│       │   ├── board
│       │   ├── crypto
│       │   ├── dictionary
│       │   ├── env
│       │   ├── genlayer
│       │   ├── logger
│       │   ├── rate-limit
│       │   ├── supabase
│       │   ├── tiles
│       │   ├── utils
│       │   └── wagmi.ts
│       ├── public
│       ├── store
│       │   └── usePlacementStore.ts
│       ├── styles
│       ├── types
│       ├── eslint.config.mjs
│       ├── next-env.d.ts
│       ├── next.config.ts
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── tsconfig.tsbuildinfo
├── contracts
│   └── genlayer
│       ├── deploy
│       ├── examples
│       │   └── submit_move.json
│       ├── tests
│       ├── README.md
│       └── wordcourt.py
├── docs
├── e2e
├── infra
├── packages
│   └── shared
│       ├── src
│       │   ├── board.test.ts
│       │   ├── board.ts
│       │   ├── colors.ts
│       │   ├── constants.ts
│       │   ├── index.ts
│       │   ├── tiles.ts
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts
│   └── recover_project_state.py
├── supabase
│   ├── functions
│   │   ├── deal-tiles
│   │   ├── draw-tiles
│   │   ├── exchange-tiles
│   │   ├── notify-turn
│   │   ├── sync-game
│   │   └── update-leaderboard
│   └── migrations
│       ├── 0001_initial_schema.sql
│       ├── 0002_word_mode_theme.sql
│       └── 0003_grants.sql
├── tests
│   ├── integration
│   └── unit
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.base.json
└── turbo.json
```

---

## 2. Detected package.json Files

### `package.json`
- **name**: `wordcourt` v0.1.0

### `apps\web\package.json`
- **name**: `@wordcourt/web` v0.1.0
- **key deps**: @rainbow-me/rainbowkit, @supabase/ssr, @supabase/supabase-js, @tanstack/react-query, @wordcourt/shared, jose, siwe, clsx, framer-motion, genlayer-js

### `packages\shared\package.json`
- **name**: `@wordcourt/shared` v0.1.0

---

## 3. Frontend Framework & Dependencies

Detected in `apps/web/package.json`:

> Next.js 15.5.4, React 19.1.1, TailwindCSS ^4.0.6, Framer Motion ^12.4.1, wagmi ^2.14.11, viem ^2.22.21, RainbowKit ^2.2.4, TanStack Query ^5.66.0, Zustand ^5.0.3, genlayer-js 1.1.7, Supabase JS ^2.46.1

---

## 4. GenLayer Contract

**File:** `contracts/genlayer/wordcourt.py`

**Status:** FOUND (1340 lines)

**Detected write functions:**

- ✅ `create_game`
- ✅ `join_game`
- ✅ `commit_tile_bag`
- ✅ `commit_rack`
- ✅ `start_game`
- ✅ `submit_move`
- ✅ `challenge_move`
- ✅ `resolve_challenge`
- ✅ `pass_turn`
- ✅ `record_exchange`
- ✅ `forfeit_game`
- ✅ `end_game`

**Detected view functions:**

- ✅ `get_game`
- ✅ `get_board`
- ✅ `get_scores`
- ✅ `get_current_turn`
- ✅ `get_move_history`
- ✅ `get_last_move`
- ✅ `get_challenges`
- ✅ `get_winner`

---

## 5. Supabase Migrations

- ✅ `0001_initial_schema.sql`
- ✅ `0002_word_mode_theme.sql`
- ✅ `0003_grants.sql`

---

## 6. Supabase Edge Functions

- ❌ `deal-tiles`: EMPTY (gitkeep only)
- ❌ `draw-tiles`: EMPTY (gitkeep only)
- ❌ `exchange-tiles`: EMPTY (gitkeep only)
- ❌ `notify-turn`: EMPTY (gitkeep only)
- ❌ `sync-game`: EMPTY (gitkeep only)
- ❌ `update-leaderboard`: EMPTY (gitkeep only)

---

## 7. Wallet Integration

- ✅ `apps/web/lib/wagmi.ts`
- ✅ `apps/web/components/wallet/ConnectButton.tsx`
- ✅ `apps/web/components/providers/Providers.tsx`
- ✅ `apps/web/hooks/useWalletAuth.ts`

---

## 8. GenLayer Contract Integration (Frontend)

- ✅ `apps/web/lib/genlayer/client.ts`
- ✅ `apps/web/lib/genlayer/contract.ts`
- ✅ `apps/web/lib/genlayer/chain.ts`
- ✅ `apps/web/lib/genlayer/types.ts`

---

## 9. Tests

- ✅ `packages\shared\src\board.test.ts`

**Missing test coverage:**
- ❌ `tests/unit/`
- ❌ `tests/integration/`
- ❌ `e2e/`

---

## 10. Environment Files

- `.env.example`
- `apps\web\.env.local`
- `apps\web\.env.local.example`

---

## 11. CI Files

- ❌ No GitHub Actions workflows found in `.github/workflows/`

---

## 12. Deployment Files

- ❌ No deployment scripts found

---

## 13. Empty / Placeholder Library Directories

- ❌ `apps/web/lib/board/`: EMPTY
- ❌ `apps/web/lib/crypto/`: EMPTY
- ❌ `apps/web/lib/dictionary/`: EMPTY
- ❌ `apps/web/lib/rate-limit/`: EMPTY

---

## 14. Smell Detection (TODOs, Placeholders, Mocks)

### `TODO`
- scripts\recover_project_state.py (1 hit(s))

### `placeholder`
- apps\web\components\lobby\CreateGameDialog.tsx (1 hit(s))
- apps\web\components\ui\Input.tsx (1 hit(s))
- apps\web\lib\env\client.ts (2 hit(s))
- scripts\recover_project_state.py (5 hit(s))

### `mock`
- pnpm-lock.yaml (3 hit(s))
- scripts\recover_project_state.py (1 hit(s))

### `fake`
- scripts\recover_project_state.py (1 hit(s))

### `implement later`
- scripts\recover_project_state.py (1 hit(s))

### `coming soon`
- scripts\recover_project_state.py (1 hit(s))

---

## 15. Completed Architecture Pieces

- ✅ GenLayer contract file
- ✅ Migration 0001 (initial schema)
- ✅ Migration 0002 (word mode)
- ✅ Migration 0003 (grants)
- ✅ Page: / (landing)
- ✅ Page: /lobby
- ✅ Page: /game/[gameId]
- ✅ Page: /leaderboard
- ✅ Page: /history
- ✅ Page: /profile/[wallet]
- ✅ API: /api/rooms
- ✅ API: /api/tiles/deal
- ✅ API: /api/racks/[gameId]
- ✅ Component: ScrabbleBoard
- ✅ Component: BoardSquare
- ✅ Component: TileRack
- ✅ Component: Tile
- ✅ Component: ScorePanel
- ✅ Lib: genlayer/client
- ✅ Lib: genlayer/contract
- ✅ Lib: supabase/browser
- ✅ Lib: supabase/server
- ✅ Lib: supabase/admin
- ✅ Lib: tiles/bag
- ✅ Lib: tiles/commitments
- ✅ Lib: auth/jwt
- ✅ Lib: auth/session
- ✅ Lib: env/client
- ✅ Hook: useWalletAuth
- ✅ Store: usePlacementStore
- ✅ Package: shared/types
- ✅ Package: shared/board
- ✅ Package: shared/tiles
- ✅ Test: shared board.test
- ✅ Env: .env.example (root)
- ✅ Env: .env.local.example (web)

---

## 16. Missing / Incomplete Architecture Pieces

- ❌ Edge Function: deal-tiles
- ❌ Edge Function: draw-tiles
- ❌ Edge Function: exchange-tiles
- ❌ Edge Function: sync-game
- ❌ Edge Function: update-leaderboard
- ❌ Edge Function: notify-turn
- ❌ API: /api/tiles/draw
- ❌ API: /api/tiles/exchange
- ❌ API: /api/genlayer/sync-game
- ❌ API: /api/genlayer/record-tx
- ❌ API: /api/leaderboard
- ❌ Component: TurnPanel
- ❌ Component: MovePreview
- ❌ Component: ChallengeModal
- ❌ Component: ExchangeTilesModal
- ❌ Component: MoveHistory
- ❌ Component: ChatPanel
- ❌ Component: WinnerModal
- ❌ Component: GenLayerProofPanel
- ❌ Lib: board (client-side logic)
- ❌ Lib: rate-limit
- ❌ Hook: useGame
- ❌ Hook: useRealtime
- ❌ Hook: useChat
- ❌ Store: useGameStore
- ❌ Test: unit tests
- ❌ Test: integration tests
- ❌ Test: e2e tests
- ❌ CI: GitHub Actions workflow
- ❌ Deployment: deploy script

---

## 17. Risk Areas


- **nextRackCommitment placeholder** in `apps/web/app/game/[gameId]/page.tsx`: uses `` `pending_${gameId}_${Date.now()}` `` instead of a real rack commitment hash after drawing tiles. This breaks the GenLayer commitment chain.
- **Exchange tiles flow is disabled** in the game page UI (button is present but disabled with a comment "Exchange UI coming next phase").
- **No Supabase Edge Functions implemented**: all 6 function directories only contain `.gitkeep`. The tile deal flow currently runs via the Next.js API route (`/api/tiles/deal`), not the Supabase Edge Function.
- **No Supabase Realtime wiring**: no hooks or subscriptions for live board/move/chat updates. The game page uses a 7-second polling interval instead.
- **Missing challenge UI**: `ChallengeModal` does not exist. Challenge moves cannot be triggered from the frontend even though the contract supports them.
- **Missing chat**: `ChatPanel` does not exist. The `chat_messages` table exists in Supabase but is not used.
- **No GenLayer proof panel**: `GenLayerProofPanel` does not exist, breaking the auditability feature.
- **`/api/genlayer/sync-game` is a `.gitkeep`**: GenLayer-to-Supabase state sync is not implemented.
- **`/api/genlayer/record-tx` is a `.gitkeep`**: Transaction indexing is not implemented.
- **`/api/leaderboard` is a `.gitkeep`**: The leaderboard page likely renders empty or errors.
- **`/api/tiles/draw` is a `.gitkeep`**: After submitting a valid move, replacement tiles are not drawn from Supabase. Rack stays stale.
- **`/api/tiles/exchange` is a `.gitkeep`**: Exchange flow is incomplete end-to-end.
- **No rate limiting**: `lib/rate-limit/` is empty. API routes are unprotected.
- **No unit or integration tests**: `tests/unit/` and `tests/integration/` contain only `.gitkeep`.
- **No E2E tests**: `e2e/` contains only `.gitkeep`.
- **No CI pipeline**: `.github/workflows/` is empty or missing.
- **No deployment scripts**: `scripts/` and `infra/` contain only `.gitkeep`.

---

## 18. Exact Recommended Continuation Phase


### Current Phase: Stopped at start of Phase 3 — Complete the Core Game Loop

#### What is DONE (Phase 1 + Phase 2 complete):
- ✅ Project structure, monorepo, turbo, pnpm
- ✅ Next.js 15, TypeScript, TailwindCSS, environment validation
- ✅ GenLayer contract (`wordcourt.py`) — 1340 lines, fully implemented
- ✅ Supabase schema (3 migrations with all tables, indexes, RLS, realtime)
- ✅ Supabase client/server/admin config
- ✅ Wallet connection (wagmi + viem + RainbowKit + SIWE auth)
- ✅ packages/shared (types, board, tiles, constants, colors — with board.test.ts)
- ✅ Frontend pages: landing, lobby, game/[gameId], leaderboard, history, profile
- ✅ Core game UI: ScrabbleBoard, BoardSquare, Tile, TileRack, ScorePanel
- ✅ Lobby: CreateGameDialog, RoomCard, room listing
- ✅ API routes: /api/rooms, /api/auth/*, /api/games/[gameId], /api/racks/[gameId], /api/tiles/deal
- ✅ GenLayer lib: client, contract (all write + view wrappers), chain, types
- ✅ Tiles lib: bag generation, commitments (hash bag + hash rack)
- ✅ Logging, analytics stubs
- ✅ usePlacementStore (tile drag + placement state)
- ✅ useWalletAuth (SIWE sign-in/out)

#### What to build NEXT — Phase 3 (in order):

**Step 3A — Complete the tile draw loop** (CRITICAL: rack stays stale without this)
1. Implement `apps/web/app/api/tiles/draw/route.ts` (draw replacement tiles after a valid move)
2. Wire `handleSubmitMove` in game page to call `/api/tiles/draw` after GenLayer accepts move
3. Replace the placeholder `nextRackCommitment` with the real hash from the draw response

**Step 3B — Exchange tiles flow**
4. Implement `apps/web/app/api/tiles/exchange/route.ts`
5. Build `components/scrabble/ExchangeTilesModal.tsx`
6. Wire exchange button in game page

**Step 3C — Challenge system UI**
7. Build `components/scrabble/ChallengeModal.tsx`
8. Wire challenge button in game page (call `challengeMove` then `resolveChallenge`)

**Step 3D — Chat**
9. Build `components/scrabble/ChatPanel.tsx`
10. Use Supabase Realtime on `chat_messages` channel

**Step 3E — GenLayer sync + proof panel**
11. Implement `apps/web/app/api/genlayer/sync-game/route.ts`
12. Implement `apps/web/app/api/genlayer/record-tx/route.ts`
13. Build `components/scrabble/GenLayerProofPanel.tsx`

**Step 3F — Leaderboard + WinnerModal**
14. Implement `apps/web/app/api/leaderboard/route.ts`
15. Build `components/scrabble/WinnerModal.tsx`
16. Wire winner detection in game page

**Step 3G — Supabase Realtime subscriptions**
17. Build `hooks/useRealtime.ts` (subscribe to game, board_cells, moves channels)
18. Replace polling intervals with Realtime in game and lobby pages

**Step 3H — Missing lib directories**
19. Implement `lib/board/` (client-side board helpers, score preview)
20. Implement `lib/rate-limit/` (API route protection)

**Step 3I — Tests + CI**
21. Unit tests in `tests/unit/`
22. Integration tests in `tests/integration/`
23. E2E tests in `e2e/`
24. GitHub Actions workflow in `.github/workflows/ci.yml`

**Step 3J — Deployment scripts**
25. `scripts/deploy.sh` (or PowerShell equivalent)
26. `infra/` (Vercel or other deployment config)

#### Immediate first action:
Implement `apps/web/app/api/tiles/draw/route.ts` and fix the `nextRackCommitment` placeholder in the game page.
This is the highest-risk blocker: without it, tile racks never replenish after a valid move.
