"""
WordCourt - Recovery Audit Script
Run from the project root: python scripts/recover_project_state.py
Generates: docs/recovery_status_report.md
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.parent
REPORT = ROOT / "docs" / "recovery_status_report.md"

SKIP_DIRS = {
    "node_modules", ".next", ".git", "__pycache__",
    ".vite", ".vitest", "dist", "build", ".turbo",
}

SMELL_PATTERNS = {
    "TODO": re.compile(r"\bTODO\b", re.IGNORECASE),
    "placeholder": re.compile(r"\bplaceholder\b", re.IGNORECASE),
    "mock": re.compile(r"\bMOCK\b", re.IGNORECASE),
    "fake": re.compile(r"\bFAKE\b", re.IGNORECASE),
    "implement later": re.compile(r"implement\s+later", re.IGNORECASE),
    "coming soon": re.compile(r"coming\s+soon", re.IGNORECASE),
}

REQUIRED_ARCH = {
    # GenLayer contract
    "GenLayer contract file": ROOT / "contracts" / "genlayer" / "wordcourt.py",
    # Supabase migrations
    "Migration 0001 (initial schema)": ROOT / "supabase" / "migrations" / "0001_initial_schema.sql",
    "Migration 0002 (word mode)": ROOT / "supabase" / "migrations" / "0002_word_mode_theme.sql",
    "Migration 0003 (grants)": ROOT / "supabase" / "migrations" / "0003_grants.sql",
    # Edge Functions
    "Edge Function: deal-tiles": ROOT / "supabase" / "functions" / "deal-tiles" / "index.ts",
    "Edge Function: draw-tiles": ROOT / "supabase" / "functions" / "draw-tiles" / "index.ts",
    "Edge Function: exchange-tiles": ROOT / "supabase" / "functions" / "exchange-tiles" / "index.ts",
    "Edge Function: sync-game": ROOT / "supabase" / "functions" / "sync-game" / "index.ts",
    "Edge Function: update-leaderboard": ROOT / "supabase" / "functions" / "update-leaderboard" / "index.ts",
    "Edge Function: notify-turn": ROOT / "supabase" / "functions" / "notify-turn" / "index.ts",
    # Frontend pages
    "Page: / (landing)": ROOT / "apps" / "web" / "app" / "page.tsx",
    "Page: /lobby": ROOT / "apps" / "web" / "app" / "lobby" / "page.tsx",
    "Page: /game/[gameId]": ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx",
    "Page: /leaderboard": ROOT / "apps" / "web" / "app" / "leaderboard" / "page.tsx",
    "Page: /history": ROOT / "apps" / "web" / "app" / "history" / "page.tsx",
    "Page: /profile/[wallet]": ROOT / "apps" / "web" / "app" / "profile" / "[wallet]" / "page.tsx",
    # API routes
    "API: /api/rooms": ROOT / "apps" / "web" / "app" / "api" / "rooms" / "route.ts",
    "API: /api/tiles/deal": ROOT / "apps" / "web" / "app" / "api" / "tiles" / "deal" / "route.ts",
    "API: /api/tiles/draw": ROOT / "apps" / "web" / "app" / "api" / "tiles" / "draw" / "route.ts",
    "API: /api/tiles/exchange": ROOT / "apps" / "web" / "app" / "api" / "tiles" / "exchange" / "route.ts",
    "API: /api/genlayer/sync-game": ROOT / "apps" / "web" / "app" / "api" / "genlayer" / "sync-game" / "route.ts",
    "API: /api/genlayer/record-tx": ROOT / "apps" / "web" / "app" / "api" / "genlayer" / "record-tx" / "route.ts",
    "API: /api/leaderboard": ROOT / "apps" / "web" / "app" / "api" / "leaderboard" / "route.ts",
    "API: /api/racks/[gameId]": ROOT / "apps" / "web" / "app" / "api" / "racks" / "[gameId]" / "route.ts",
    # Scrabble components
    "Component: ScrabbleBoard": ROOT / "apps" / "web" / "components" / "scrabble" / "ScrabbleBoard.tsx",
    "Component: BoardSquare": ROOT / "apps" / "web" / "components" / "scrabble" / "BoardSquare.tsx",
    "Component: TileRack": ROOT / "apps" / "web" / "components" / "scrabble" / "TileRack.tsx",
    "Component: Tile": ROOT / "apps" / "web" / "components" / "scrabble" / "Tile.tsx",
    "Component: ScorePanel": ROOT / "apps" / "web" / "components" / "scrabble" / "ScorePanel.tsx",
    "Component: TurnPanel": ROOT / "apps" / "web" / "components" / "scrabble" / "TurnPanel.tsx",
    "Component: MovePreview": ROOT / "apps" / "web" / "components" / "scrabble" / "MovePreview.tsx",
    "Component: ChallengeModal": ROOT / "apps" / "web" / "components" / "scrabble" / "ChallengeModal.tsx",
    "Component: ExchangeTilesModal": ROOT / "apps" / "web" / "components" / "scrabble" / "ExchangeTilesModal.tsx",
    "Component: MoveHistory": ROOT / "apps" / "web" / "components" / "scrabble" / "MoveHistory.tsx",
    "Component: ChatPanel": ROOT / "apps" / "web" / "components" / "scrabble" / "ChatPanel.tsx",
    "Component: WinnerModal": ROOT / "apps" / "web" / "components" / "scrabble" / "WinnerModal.tsx",
    "Component: GenLayerProofPanel": ROOT / "apps" / "web" / "components" / "scrabble" / "GenLayerProofPanel.tsx",
    # Lib
    "Lib: genlayer/client": ROOT / "apps" / "web" / "lib" / "genlayer" / "client.ts",
    "Lib: genlayer/contract": ROOT / "apps" / "web" / "lib" / "genlayer" / "contract.ts",
    "Lib: supabase/browser": ROOT / "apps" / "web" / "lib" / "supabase" / "browser.ts",
    "Lib: supabase/server": ROOT / "apps" / "web" / "lib" / "supabase" / "server.ts",
    "Lib: supabase/admin": ROOT / "apps" / "web" / "lib" / "supabase" / "admin.ts",
    "Lib: tiles/bag": ROOT / "apps" / "web" / "lib" / "tiles" / "bag.ts",
    "Lib: tiles/commitments": ROOT / "apps" / "web" / "lib" / "tiles" / "commitments.ts",
    "Lib: auth/jwt": ROOT / "apps" / "web" / "lib" / "auth" / "jwt.ts",
    "Lib: auth/session": ROOT / "apps" / "web" / "lib" / "auth" / "session.ts",
    "Lib: board (client-side logic)": ROOT / "apps" / "web" / "lib" / "board" / "index.ts",
    "Lib: rate-limit": ROOT / "apps" / "web" / "lib" / "rate-limit" / "index.ts",
    "Lib: env/client": ROOT / "apps" / "web" / "lib" / "env" / "client.ts",
    # Hooks
    "Hook: useWalletAuth": ROOT / "apps" / "web" / "hooks" / "useWalletAuth.ts",
    "Hook: useGame": ROOT / "apps" / "web" / "hooks" / "useGame.ts",
    "Hook: useRealtime": ROOT / "apps" / "web" / "hooks" / "useRealtime.ts",
    "Hook: useChat": ROOT / "apps" / "web" / "hooks" / "useChat.ts",
    # Store
    "Store: usePlacementStore": ROOT / "apps" / "web" / "store" / "usePlacementStore.ts",
    "Store: useGameStore": ROOT / "apps" / "web" / "store" / "useGameStore.ts",
    # Packages
    "Package: shared/types": ROOT / "packages" / "shared" / "src" / "types.ts",
    "Package: shared/board": ROOT / "packages" / "shared" / "src" / "board.ts",
    "Package: shared/tiles": ROOT / "packages" / "shared" / "src" / "tiles.ts",
    # Tests
    "Test: shared board.test": ROOT / "packages" / "shared" / "src" / "board.test.ts",
    "Test: unit tests": ROOT / "tests" / "unit" / "board.test.ts",
    "Test: integration tests": ROOT / "tests" / "integration" / "game.test.ts",
    "Test: e2e tests": ROOT / "e2e" / "game.spec.ts",
    # CI
    "CI: GitHub Actions workflow": ROOT / ".github" / "workflows" / "ci.yml",
    # Deployment
    "Deployment: deploy script": ROOT / "scripts" / "deploy.sh",
    # Env
    "Env: .env.example (root)": ROOT / ".env.example",
    "Env: .env.local.example (web)": ROOT / "apps" / "web" / ".env.local.example",
}

CONTRACT_WRITE_FNS = [
    "create_game", "join_game", "commit_tile_bag", "commit_rack",
    "start_game", "submit_move", "challenge_move", "resolve_challenge",
    "pass_turn", "record_exchange", "forfeit_game", "end_game",
]

CONTRACT_VIEW_FNS = [
    "get_game", "get_board", "get_scores", "get_current_turn",
    "get_move_history", "get_last_move", "get_challenges", "get_winner",
]


def is_empty_or_gitkeep(path: Path) -> bool:
    if not path.exists():
        return True
    if path.is_dir():
        files = [f for f in path.rglob("*") if f.is_file() and f.name != ".gitkeep"]
        return len(files) == 0
    content = path.read_text(encoding="utf-8", errors="ignore").strip()
    return len(content) == 0


def walk_source_files(root: Path):
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            if fname == ".gitkeep":
                continue
            ext = Path(fname).suffix.lower()
            if ext in (".ts", ".tsx", ".py", ".sql", ".js", ".json", ".yml", ".yaml", ".md"):
                results.append(Path(dirpath) / fname)
    return results


def detect_smells(files):
    smells = {k: [] for k in SMELL_PATTERNS}
    for fpath in files:
        try:
            content = fpath.read_text(encoding="utf-8", errors="ignore")
            rel = str(fpath.relative_to(ROOT))
            for label, pattern in SMELL_PATTERNS.items():
                matches = list(pattern.finditer(content))
                if matches:
                    smells[label].append(f"{rel} ({len(matches)} hit(s))")
        except Exception:
            pass
    return smells


def check_contract_functions(contract_path: Path):
    if not contract_path.exists():
        return [], []
    content = contract_path.read_text(encoding="utf-8", errors="ignore")
    found_write = [fn for fn in CONTRACT_WRITE_FNS if f"def {fn}" in content]
    found_view = [fn for fn in CONTRACT_VIEW_FNS if f"def {fn}" in content]
    missing_write = [fn for fn in CONTRACT_WRITE_FNS if fn not in found_write]
    missing_view = [fn for fn in CONTRACT_VIEW_FNS if fn not in found_view]
    return (found_write + found_view), (missing_write + missing_view)


def check_package_json_files():
    pkgs = []
    for p in ROOT.rglob("package.json"):
        if any(skip in str(p) for skip in SKIP_DIRS):
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            pkgs.append({
                "path": str(p.relative_to(ROOT)),
                "name": data.get("name", "?"),
                "version": data.get("version", "?"),
                "deps": list(data.get("dependencies", {}).keys())[:20],
            })
        except Exception:
            pass
    return pkgs


def build_folder_tree(root: Path, prefix="", depth=0, max_depth=4):
    if depth > max_depth:
        return ""
    lines = []
    try:
        entries = sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    except PermissionError:
        return ""
    for entry in entries:
        if entry.name in SKIP_DIRS or entry.name.startswith("."):
            continue
        connector = "├── " if entry != entries[-1] else "└── "
        lines.append(f"{prefix}{connector}{entry.name}")
        if entry.is_dir():
            extension = "│   " if entry != entries[-1] else "    "
            lines.append(build_folder_tree(entry, prefix + extension, depth + 1, max_depth))
    return "\n".join(l for l in lines if l)


def detect_frontend_framework():
    pkg = ROOT / "apps" / "web" / "package.json"
    if not pkg.exists():
        return "unknown"
    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        frameworks = []
        checks = {
            "next": "Next.js",
            "react": "React",
            "tailwindcss": "TailwindCSS",
            "framer-motion": "Framer Motion",
            "wagmi": "wagmi",
            "viem": "viem",
            "@rainbow-me/rainbowkit": "RainbowKit",
            "@tanstack/react-query": "TanStack Query",
            "zustand": "Zustand",
            "genlayer-js": "genlayer-js",
            "@supabase/supabase-js": "Supabase JS",
        }
        for dep, label in checks.items():
            if dep in deps:
                frameworks.append(f"{label} {deps[dep]}")
        return ", ".join(frameworks) if frameworks else "unknown"
    except Exception:
        return "unknown"


def main():
    print("WordCourt Recovery Audit — scanning project...")
    all_files = walk_source_files(ROOT)
    smells = detect_smells(all_files)
    contract_path = ROOT / "contracts" / "genlayer" / "wordcourt.py"
    found_fns, missing_fns = check_contract_functions(contract_path)
    pkgs = check_package_json_files()
    framework_str = detect_frontend_framework()

    completed = []
    missing = []

    for label, path in REQUIRED_ARCH.items():
        if path.exists() and not is_empty_or_gitkeep(path):
            completed.append(label)
        else:
            missing.append(label)

    # Detect supabase migrations
    migrations = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
    migration_list = [m.name for m in migrations]

    # Edge function status
    ef_root = ROOT / "supabase" / "functions"
    ef_status = {}
    for ef_dir in ef_root.iterdir():
        if ef_dir.is_dir():
            index = ef_dir / "index.ts"
            ef_status[ef_dir.name] = "IMPLEMENTED" if (index.exists() and not is_empty_or_gitkeep(index)) else "EMPTY (gitkeep only)"

    # Wallet integration check
    wallet_files = [
        "apps/web/lib/wagmi.ts",
        "apps/web/components/wallet/ConnectButton.tsx",
        "apps/web/components/providers/Providers.tsx",
        "apps/web/hooks/useWalletAuth.ts",
    ]
    wallet_status = {f: "FOUND" if (ROOT / f).exists() else "MISSING" for f in wallet_files}

    # Contract integration check
    gl_files = [
        "apps/web/lib/genlayer/client.ts",
        "apps/web/lib/genlayer/contract.ts",
        "apps/web/lib/genlayer/chain.ts",
        "apps/web/lib/genlayer/types.ts",
    ]
    gl_status = {f: "FOUND" if (ROOT / f).exists() else "MISSING" for f in gl_files}

    # Test detection
    test_files = [f for f in all_files if ".test." in f.name or ".spec." in f.name]

    # CI detection
    ci_dir = ROOT / ".github" / "workflows"
    ci_files = list(ci_dir.glob("*.yml")) + list(ci_dir.glob("*.yaml")) if ci_dir.exists() else []

    # Deployment scripts
    deploy_scripts = [f for f in all_files if "deploy" in f.name.lower() or "release" in f.name.lower()]

    # Env files
    env_files = [str(f.relative_to(ROOT)) for f in ROOT.rglob(".env*") if not any(s in str(f) for s in SKIP_DIRS)]

    # Incomplete/missing critical lib directories
    lib_dirs = {
        "lib/board": ROOT / "apps" / "web" / "lib" / "board",
        "lib/crypto": ROOT / "apps" / "web" / "lib" / "crypto",
        "lib/dictionary": ROOT / "apps" / "web" / "lib" / "dictionary",
        "lib/rate-limit": ROOT / "apps" / "web" / "lib" / "rate-limit",
    }
    empty_lib_dirs = {k: "EMPTY" if is_empty_or_gitkeep(v) else "HAS FILES" for k, v in lib_dirs.items()}

    # Folder tree (depth 3)
    tree = build_folder_tree(ROOT, max_depth=3)

    # ---------------------------------------------------------------- Write report
    lines = []
    a = lines.append

    a("# WordCourt — Recovery Status Report")
    a(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    a("---\n")
    a("## 1. Detected Folder Tree\n")
    a("```")
    a(tree)
    a("```\n")

    a("---\n")
    a("## 2. Detected package.json Files\n")
    for pkg in pkgs:
        a(f"### `{pkg['path']}`")
        a(f"- **name**: `{pkg['name']}` v{pkg['version']}")
        if pkg["deps"]:
            a(f"- **key deps**: {', '.join(pkg['deps'][:10])}")
        a("")

    a("---\n")
    a("## 3. Frontend Framework & Dependencies\n")
    a(f"Detected in `apps/web/package.json`:\n")
    a(f"> {framework_str}\n")

    a("---\n")
    a("## 4. GenLayer Contract\n")
    a(f"**File:** `contracts/genlayer/wordcourt.py`\n")
    if contract_path.exists():
        size = len(contract_path.read_text(encoding="utf-8", errors="ignore").splitlines())
        a(f"**Status:** FOUND ({size} lines)\n")
        a("**Detected write functions:**\n")
        for fn in found_fns:
            if fn in CONTRACT_WRITE_FNS:
                a(f"- ✅ `{fn}`")
        a("\n**Detected view functions:**\n")
        for fn in found_fns:
            if fn in CONTRACT_VIEW_FNS:
                a(f"- ✅ `{fn}`")
        if missing_fns:
            a("\n**Missing functions:**\n")
            for fn in missing_fns:
                a(f"- ❌ `{fn}`")
    else:
        a("**Status:** ❌ NOT FOUND\n")

    a("\n---\n")
    a("## 5. Supabase Migrations\n")
    if migration_list:
        for m in migration_list:
            a(f"- ✅ `{m}`")
    else:
        a("- ❌ No migrations found")
    a("")

    a("---\n")
    a("## 6. Supabase Edge Functions\n")
    for name, status in ef_status.items():
        icon = "✅" if "IMPLEMENTED" in status else "❌"
        a(f"- {icon} `{name}`: {status}")
    a("")

    a("---\n")
    a("## 7. Wallet Integration\n")
    for f, status in wallet_status.items():
        icon = "✅" if status == "FOUND" else "❌"
        a(f"- {icon} `{f}`")
    a("")

    a("---\n")
    a("## 8. GenLayer Contract Integration (Frontend)\n")
    for f, status in gl_status.items():
        icon = "✅" if status == "FOUND" else "❌"
        a(f"- {icon} `{f}`")
    a("")

    a("---\n")
    a("## 9. Tests\n")
    if test_files:
        for tf in test_files:
            a(f"- ✅ `{tf.relative_to(ROOT)}`")
    else:
        a("- ❌ No test files found outside packages/shared\n")
    a("")
    a("**Missing test coverage:**")
    for t in ["tests/unit/", "tests/integration/", "e2e/"]:
        p = ROOT / t.rstrip("/")
        has_files = p.exists() and any(f.suffix in (".ts", ".tsx") for f in p.rglob("*"))
        icon = "✅" if has_files else "❌"
        a(f"- {icon} `{t}`")
    a("")

    a("---\n")
    a("## 10. Environment Files\n")
    for ef in env_files:
        a(f"- `{ef}`")
    a("")

    a("---\n")
    a("## 11. CI Files\n")
    if ci_files:
        for cf in ci_files:
            a(f"- ✅ `{cf.relative_to(ROOT)}`")
    else:
        a("- ❌ No GitHub Actions workflows found in `.github/workflows/`")
    a("")

    a("---\n")
    a("## 12. Deployment Files\n")
    if deploy_scripts:
        for ds in deploy_scripts:
            a(f"- `{ds.relative_to(ROOT)}`")
    else:
        a("- ❌ No deployment scripts found")
    a("")

    a("---\n")
    a("## 13. Empty / Placeholder Library Directories\n")
    for k, v in empty_lib_dirs.items():
        icon = "❌" if v == "EMPTY" else "✅"
        a(f"- {icon} `apps/web/lib/{k.split('/')[-1]}/`: {v}")
    a("")

    a("---\n")
    a("## 14. Smell Detection (TODOs, Placeholders, Mocks)\n")
    any_smells = False
    for label, hits in smells.items():
        if hits:
            any_smells = True
            a(f"### `{label}`")
            for h in hits:
                a(f"- {h}")
            a("")
    if not any_smells:
        a("No major smell patterns detected.\n")

    a("---\n")
    a("## 15. Completed Architecture Pieces\n")
    for item in completed:
        a(f"- ✅ {item}")
    a("")

    a("---\n")
    a("## 16. Missing / Incomplete Architecture Pieces\n")
    for item in missing:
        a(f"- ❌ {item}")
    a("")

    a("---\n")
    a("## 17. Risk Areas\n")
    a("""
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
""")

    a("---\n")
    a("## 18. Exact Recommended Continuation Phase\n")
    a("""
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
""")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nReport written to: {REPORT}")
    print(f"Completed: {len(completed)}")
    print(f"Missing:   {len(missing)}")
    total_smells = sum(len(v) for v in smells.values())
    print(f"Smells:    {total_smells}")


if __name__ == "__main__":
    main()
