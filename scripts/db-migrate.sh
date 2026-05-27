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
