"""
Creates:
  .github/workflows/ci.yml        — pnpm install, typecheck, test, build
  scripts/db-migrate.sh           — runs Supabase migrations
  scripts/deploy-functions.sh     — deploys Edge Functions via Supabase CLI
  scripts/validate-env.sh         — checks required env vars before deploy
"""
import pathlib, os

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# CI workflow
# ---------------------------------------------------------------------------
GH = ROOT / ".github" / "workflows"
GH.mkdir(parents=True, exist_ok=True)

CI = GH / "ci.yml"
CI.write_text("""\
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

env:
  PNPM_VERSION: "9"
  NODE_VERSION: "20"

jobs:
  lint-typecheck-test:
    name: Lint / Typecheck / Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          run_install: false

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck (shared)
        run: pnpm --filter @wordcourt/shared tsc --noEmit

      - name: Typecheck (web)
        run: pnpm --filter web tsc --noEmit
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
          NEXT_PUBLIC_GENLAYER_EXPLORER_URL: https://explorer.genlayer.com
          NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000"
          NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: placeholder
          NEXT_PUBLIC_APP_URL: http://localhost:3000

      - name: Run unit tests
        run: pnpm --filter web test --run
        env:
          SUPABASE_SERVICE_ROLE_KEY: placeholder
          JWT_SECRET: placeholder-32-char-secret-key-here
          GENLAYER_RPC_URL: https://rpc.genlayer.com
          GENLAYER_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000"

      - name: Build shared
        run: pnpm --filter @wordcourt/shared build

      - name: Build web
        run: pnpm --filter web build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
          NEXT_PUBLIC_GENLAYER_EXPLORER_URL: https://explorer.genlayer.com
          NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000"
          NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: placeholder
          NEXT_PUBLIC_APP_URL: http://localhost:3000

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: lint-typecheck-test
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Comment — preview pending
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deploy triggered — check Vercel for the preview URL.',
            });
""", encoding="utf-8")
print(f"[OK] {CI}")

# ---------------------------------------------------------------------------
# validate-env.sh
# ---------------------------------------------------------------------------
VALIDATE = ROOT / "scripts" / "validate-env.sh"
VALIDATE.write_text("""\
#!/usr/bin/env bash
# Checks that all required environment variables are set before deploy.
# Usage: source .env && bash scripts/validate-env.sh

set -euo pipefail

REQUIRED_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_GENLAYER_EXPLORER_URL
  NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS
  GENLAYER_RPC_URL
  GENLAYER_CONTRACT_ADDRESS
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
  JWT_SECRET
  NEXT_PUBLIC_APP_URL
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "[MISSING] $VAR"
    MISSING=1
  else
    echo "[OK]      $VAR"
  fi
done

if [[ $MISSING -eq 1 ]]; then
  echo ""
  echo "ERROR: One or more required environment variables are not set."
  exit 1
fi

echo ""
echo "All required environment variables are set."
""", encoding="utf-8")
print(f"[OK] {VALIDATE}")

# ---------------------------------------------------------------------------
# db-migrate.sh
# ---------------------------------------------------------------------------
MIGRATE = ROOT / "scripts" / "db-migrate.sh"
MIGRATE.write_text("""\
#!/usr/bin/env bash
# Applies all Supabase migrations to the linked project.
# Usage: bash scripts/db-migrate.sh [--dry-run]
#
# Prerequisites:
#   1. Supabase CLI installed (npm i -g supabase)
#   2. Project linked: supabase link --project-ref <ref>
#   3. SUPABASE_ACCESS_TOKEN set in env

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "[DRY RUN] Will not apply migrations."
fi

echo "Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
  echo "ERROR: Supabase CLI not found. Install with: npm install -g supabase"
  exit 1
fi

echo "Current migration status:"
supabase db diff --local 2>/dev/null || true

if [[ $DRY_RUN -eq 0 ]]; then
  echo ""
  echo "Applying migrations..."
  supabase db push
  echo "Migrations applied successfully."
else
  echo ""
  echo "Dry run complete — no changes applied."
fi
""", encoding="utf-8")
print(f"[OK] {MIGRATE}")

# ---------------------------------------------------------------------------
# deploy-functions.sh
# ---------------------------------------------------------------------------
DEPLOY = ROOT / "scripts" / "deploy-functions.sh"
DEPLOY.write_text("""\
#!/usr/bin/env bash
# Deploys all Supabase Edge Functions.
# Usage: bash scripts/deploy-functions.sh [function-name]
#   - No arg: deploys all functions
#   - With arg: deploys a single function (e.g. sync-game)
#
# Prerequisites:
#   1. Supabase CLI installed (npm i -g supabase)
#   2. Project linked: supabase link --project-ref <ref>
#   3. SUPABASE_ACCESS_TOKEN set in env

set -euo pipefail

FUNCTIONS=(
  sync-game
  update-leaderboard
  notify-turn
  deal-tiles
  draw-tiles
  exchange-tiles
)

echo "Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
  echo "ERROR: Supabase CLI not found. Install with: npm install -g supabase"
  exit 1
fi

deploy_function() {
  local FN="$1"
  echo "Deploying function: $FN"
  supabase functions deploy "$FN" --no-verify-jwt
  echo "[OK] $FN deployed"
}

if [[ -n "${1:-}" ]]; then
  deploy_function "$1"
else
  for FN in "${FUNCTIONS[@]}"; do
    deploy_function "$FN"
  done
  echo ""
  echo "All ${#FUNCTIONS[@]} functions deployed."
fi
""", encoding="utf-8")
print(f"[OK] {DEPLOY}")

print("")
print("[DONE] CI pipeline and deployment scripts created.")
print("  .github/workflows/ci.yml")
print("  scripts/validate-env.sh")
print("  scripts/db-migrate.sh")
print("  scripts/deploy-functions.sh")
