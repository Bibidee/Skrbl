"""
Phase 3B – Script 2
Patches apps/web/app/api/racks/[gameId]/route.ts

Adds tileBagRemaining to the response so the game page can disable the
Exchange button when the bag is too small, without a second API call.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "api" / "racks" / "[gameId]" / "route.ts"

text = TARGET.read_text(encoding="utf-8")
original = text

# Change 1: also select tile_bag_remaining from games
OLD1 = "      .select('id')"
NEW1 = "      .select('id, tile_bag_remaining')"
if OLD1 not in text:
    print("[FAIL] Patch 1: games select anchor not found")
    sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: games query now fetches tile_bag_remaining")

# Change 2: include tileBagRemaining in the success response
OLD2 = """\
    return NextResponse.json({
      tiles: data.tiles,
      rackCommitment: data.rack_commitment,
      rackVersion: data.rack_version,
      updatedAt: data.updated_at,
    });"""

NEW2 = """\
    return NextResponse.json({
      tiles: data.tiles,
      rackCommitment: data.rack_commitment,
      rackVersion: data.rack_version,
      updatedAt: data.updated_at,
      tileBagRemaining: (game as { id: string; tile_bag_remaining: number | null }).tile_bag_remaining ?? 0,
    });"""

if OLD2 not in text:
    print("[FAIL] Patch 2: response JSON anchor not found")
    sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: response now includes tileBagRemaining")

TARGET.write_text(text, encoding="utf-8")
print(f"[OK] Wrote {TARGET}")
