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
