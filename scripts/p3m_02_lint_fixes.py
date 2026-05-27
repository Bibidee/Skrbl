"""
Fixes two ESLint warnings from the build:
1. exchange/route.ts:96  — 'idsSet' assigned but never used (remove dead var)
2. ChallengeModal.tsx:28 — 'walletAddress' defined but never used (prefix with _)
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Fix 1: remove idsSet ---
EXCHANGE = ROOT / "apps" / "web" / "app" / "api" / "tiles" / "exchange" / "route.ts"
text = EXCHANGE.read_text(encoding="utf-8")
OLD1 = """\
    // Validate that every requested tile ID exists in the rack
    const idsSet = new Set(tileIdsToExchange);
    const missing = tileIdsToExchange.filter((id) => !currentRack.some((t) => t.id === id));"""
NEW1 = """\
    // Validate that every requested tile ID exists in the rack
    const missing = tileIdsToExchange.filter((id) => !currentRack.some((t) => t.id === id));"""
if OLD1 not in text:
    print("[FAIL] exchange/route.ts patch not found"); sys.exit(1)
EXCHANGE.write_text(text.replace(OLD1, NEW1, 1), encoding="utf-8")
print("[OK] Removed unused idsSet from exchange/route.ts")

# --- Fix 2: prefix walletAddress with _ in ChallengeModal ---
MODAL = ROOT / "apps" / "web" / "components" / "scrabble" / "ChallengeModal.tsx"
text = MODAL.read_text(encoding="utf-8")

# Fix in Props type
OLD2A = "  walletAddress: string;"
NEW2A = "  _walletAddress: string;"
# Fix in destructure
OLD2B = "  walletAddress,"
NEW2B = "  _walletAddress,"
if OLD2A not in text or OLD2B not in text:
    print("[FAIL] ChallengeModal.tsx patch not found"); sys.exit(1)
text = text.replace(OLD2A, NEW2A, 1).replace(OLD2B, NEW2B, 1)
MODAL.write_text(text, encoding="utf-8")
print("[OK] Prefixed walletAddress with _ in ChallengeModal.tsx")
