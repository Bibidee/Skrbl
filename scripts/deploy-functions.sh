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
