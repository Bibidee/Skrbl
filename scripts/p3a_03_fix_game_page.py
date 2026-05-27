"""
Phase 3A – Script 3
Patches apps/web/app/game/[gameId]/page.tsx

Four targeted replacements:
  1. Add rackCommitment state variable
  2. Update refresh() to store rackCommitment from /api/racks response
  3. Replace handleSubmitMove with real two-phase draw flow
  4. Replace handlePass placeholder with rackCommitment from state
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"

text = TARGET.read_text(encoding="utf-8")
original = text  # keep for diff summary

# ---------------------------------------------------------------------------
# 1. Add rackCommitment state after the status state
# ---------------------------------------------------------------------------
OLD1 = "  const [status, setStatus] = useState<string | null>(null);"
NEW1 = (
    "  const [status, setStatus] = useState<string | null>(null);\n"
    "  const [rackCommitment, setRackCommitment] = useState<string>('');"
)
if OLD1 not in text:
    print("[FAIL] Patch 1: anchor not found — status state line missing")
    sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: added rackCommitment state")

# ---------------------------------------------------------------------------
# 2. Update refresh() rack response to also store rackCommitment
# ---------------------------------------------------------------------------
OLD2 = (
    "        const data = (await res.json()) as { tiles: RackTile[] };\n"
    "          setRack(data.tiles ?? []);"
)
NEW2 = (
    "        const data = (await res.json()) as { tiles: RackTile[]; rackCommitment: string | null };\n"
    "          setRack(data.tiles ?? []);\n"
    "          setRackCommitment(data.rackCommitment ?? '');"
)
if OLD2 not in text:
    print("[FAIL] Patch 2: anchor not found — rack fetch response cast missing")
    sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: refresh() now stores rackCommitment")

# ---------------------------------------------------------------------------
# 3. Replace handleSubmitMove with two-phase draw flow
# ---------------------------------------------------------------------------
OLD3 = '''\
  async function handleSubmitMove() {
    if (!walletClient || !game) return;
    const arr = placementsArray(placements);
    if (arr.length === 0) {
      setError('Place at least one tile.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus('Submitting move to GenLayer (validating words + score)...');
      // Frontend cannot know the official score precisely without running
      // preview_move; pass 0 and let the contract compute. The contract will
      // reject if our claim is wrong - we re-submit with the official value
      // returned from preview, when available. For MVP we use 0 + then read
      // back the official_score on the next refresh.
      // NOTE: the contract checks claimed_score == official_score strictly,
      // so we MUST use preview_move first to get the right number.
      const { previewMove } = await import('@/lib/genlayer');
      const preview = await previewMove(gameId, arr);
      const result = await submitMove(walletClient, {
        gameId,
        placements: arr,
        claimedWords: preview.formed_words,
        claimedScore: preview.official_score,
        nextRackCommitment: `pending_${gameId}_${Date.now()}`,
      });
      clientLogger.info('move accepted', { tx: result.txHash });
      clearPlacements();
      setStatus('Move accepted. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }'''

NEW3 = '''\
  async function handleSubmitMove() {
    if (!walletClient || !game) return;
    const arr = placementsArray(placements);
    if (arr.length === 0) {
      setError('Place at least one tile.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Step 1: get official score and formed words from the contract preview
      setStatus('Previewing move...');
      const { previewMove } = await import('@/lib/genlayer');
      const preview = await previewMove(gameId, arr);

      // Step 2: prepare draw — compute new rack commitment WITHOUT writing to DB.
      // We need this commitment before calling GenLayer so the contract can verify it.
      setStatus('Preparing tile draw...');
      const placedIds = arr.map((p) => p.tileId);
      const prepRes = await fetch('/api/tiles/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, placedTileIds: placedIds, phase: 'prepare' }),
      });
      if (!prepRes.ok) {
        const detail = (await prepRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`draw_prepare_failed:${detail.error ?? prepRes.status}`);
      }
      const drawPrep = (await prepRes.json()) as {
        newRack: import('@wordcourt/shared').RackTile[];
        newRackCommitment: string;
        drawnCount: number;
        tileBagRemaining: number;
      };

      // Step 3: submit the move to GenLayer with the real next rack commitment
      setStatus('Submitting move to GenLayer (validating words + score)...');
      const result = await submitMove(walletClient, {
        gameId,
        placements: arr,
        claimedWords: preview.formed_words,
        claimedScore: preview.official_score,
        nextRackCommitment: drawPrep.newRackCommitment,
      });
      clientLogger.info('move accepted', { tx: result.txHash });

      // Step 4: finalize — persist new rack + updated bag to Supabase
      setStatus('Finalizing tile draw...');
      const finalRes = await fetch('/api/tiles/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, placedTileIds: placedIds, phase: 'finalize' }),
      });
      if (!finalRes.ok) {
        // Non-fatal: GenLayer accepted the move, but DB write failed.
        // The rack will re-sync on the next refresh from /api/racks.
        clientLogger.error('draw finalize failed — rack will re-sync on refresh', { gameId });
      }

      clearPlacements();
      setStatus('Move accepted. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }'''

if OLD3 not in text:
    print("[FAIL] Patch 3: handleSubmitMove anchor not found")
    sys.exit(1)
text = text.replace(OLD3, NEW3, 1)
print("[OK] Patch 3: handleSubmitMove now uses two-phase draw flow")

# ---------------------------------------------------------------------------
# 4. Fix handlePass — replace placeholder commitment with real rackCommitment
# ---------------------------------------------------------------------------
OLD4 = '''\
  async function handlePass() {
    if (!walletClient) return;
    setBusy(true);
    setError(null);
    try {
      await passTurn(walletClient, {
        gameId,
        nextRackCommitment: `pending_${gameId}_${Date.now()}`,
      });
      clearPlacements();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }'''

NEW4 = '''\
  async function handlePass() {
    if (!walletClient) return;
    if (!rackCommitment) {
      setError('Rack commitment not loaded. Please wait for the page to fully load.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Pass does not draw new tiles; the rack commitment stays the same.
      await passTurn(walletClient, {
        gameId,
        nextRackCommitment: rackCommitment,
      });
      clearPlacements();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }'''

if OLD4 not in text:
    print("[FAIL] Patch 4: handlePass anchor not found")
    sys.exit(1)
text = text.replace(OLD4, NEW4, 1)
print("[OK] Patch 4: handlePass uses rackCommitment state (no placeholder)")

# ---------------------------------------------------------------------------
# Write result
# ---------------------------------------------------------------------------
TARGET.write_text(text, encoding="utf-8")

added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] Wrote {TARGET} (+{added} lines)")
print("[DONE] All 4 patches applied successfully.")
