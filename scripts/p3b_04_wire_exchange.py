"""
Phase 3B – Script 4
Patches apps/web/app/game/[gameId]/page.tsx to wire exchange tiles flow:

  1. Import ExchangeTilesModal and recordExchange
  2. Add tileBagRemaining + exchangeOpen state variables
  3. Update refresh() to store tileBagRemaining from /api/racks response
  4. Add handleExchange(tileIdsToExchange) function
  5. Replace disabled Exchange button with working one
  6. Add <ExchangeTilesModal> to JSX
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"

text = TARGET.read_text(encoding="utf-8")
original = text

# ---------------------------------------------------------------------------
# 1. Add recordExchange to the genlayer imports
# ---------------------------------------------------------------------------
OLD1 = """\
import {
  getGame,
  passTurn,
  resignGame,
  startGame,
  submitMove,
  commitTileBag,
  commitRack,
  type OnChainGame,
} from '@/lib/genlayer';"""

NEW1 = """\
import {
  getGame,
  passTurn,
  recordExchange,
  resignGame,
  startGame,
  submitMove,
  commitTileBag,
  commitRack,
  type OnChainGame,
} from '@/lib/genlayer';"""

if OLD1 not in text:
    print("[FAIL] Patch 1: genlayer import block not found")
    sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: added recordExchange to genlayer imports")

# ---------------------------------------------------------------------------
# 2. Add ExchangeTilesModal import after the ScorePanel import
# ---------------------------------------------------------------------------
OLD2 = "import { placementsArray, usePlacementStore } from '@/store/usePlacementStore';"
NEW2 = """\
import { ExchangeTilesModal } from '@/components/scrabble/ExchangeTilesModal';
import { placementsArray, usePlacementStore } from '@/store/usePlacementStore';"""

if OLD2 not in text:
    print("[FAIL] Patch 2: usePlacementStore import anchor not found")
    sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: added ExchangeTilesModal import")

# ---------------------------------------------------------------------------
# 3. Add tileBagRemaining + exchangeOpen states after rackCommitment state
# ---------------------------------------------------------------------------
OLD3 = "  const [rackCommitment, setRackCommitment] = useState<string>('');"
NEW3 = """\
  const [rackCommitment, setRackCommitment] = useState<string>('');
  const [tileBagRemaining, setTileBagRemaining] = useState<number>(0);
  const [exchangeOpen, setExchangeOpen] = useState(false);"""

if OLD3 not in text:
    print("[FAIL] Patch 3: rackCommitment state anchor not found")
    sys.exit(1)
text = text.replace(OLD3, NEW3, 1)
print("[OK] Patch 3: added tileBagRemaining and exchangeOpen states")

# ---------------------------------------------------------------------------
# 4. Update refresh() to also store tileBagRemaining from racks response
# ---------------------------------------------------------------------------
OLD4 = """\
        const data = (await res.json()) as { tiles: RackTile[]; rackCommitment: string | null };
          setRack(data.tiles ?? []);
          setRackCommitment(data.rackCommitment ?? '');"""

NEW4 = """\
        const data = (await res.json()) as { tiles: RackTile[]; rackCommitment: string | null; tileBagRemaining: number };
          setRack(data.tiles ?? []);
          setRackCommitment(data.rackCommitment ?? '');
          setTileBagRemaining(data.tileBagRemaining ?? 0);"""

if OLD4 not in text:
    print("[FAIL] Patch 4: refresh racks response cast anchor not found")
    sys.exit(1)
text = text.replace(OLD4, NEW4, 1)
print("[OK] Patch 4: refresh() now stores tileBagRemaining")

# ---------------------------------------------------------------------------
# 5. Add handleExchange function after handleResign
# ---------------------------------------------------------------------------
OLD5 = """\
  async function handleResign() {
    if (!walletClient) return;
    if (!confirm('Resign the game? This ends it.')) return;
    setBusy(true);
    try {
      await resignGame(walletClient, { gameId });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }"""

NEW5 = """\
  async function handleResign() {
    if (!walletClient) return;
    if (!confirm('Resign the game? This ends it.')) return;
    setBusy(true);
    try {
      await resignGame(walletClient, { gameId });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExchange(tileIdsToExchange: string[]) {
    if (!walletClient) return;
    setBusy(true);
    setError(null);
    setExchangeOpen(false);
    try {
      // Step 1: prepare — compute new rack + commitments without DB write
      setStatus('Preparing exchange...');
      const prepRes = await fetch('/api/tiles/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, tileIdsToExchange, phase: 'prepare' }),
      });
      if (!prepRes.ok) {
        const detail = (await prepRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`exchange_prepare_failed:${detail.error ?? prepRes.status}`);
      }
      const prep = (await prepRes.json()) as {
        exchangeCommitment: string;
        newRackCommitment: string;
      };

      // Step 2: record exchange on GenLayer
      setStatus('Submitting exchange to GenLayer...');
      await recordExchange(walletClient, {
        gameId,
        exchangeCommitment: prep.exchangeCommitment,
        nextRackCommitment: prep.newRackCommitment,
      });

      // Step 3: finalize — persist new rack + bag
      setStatus('Finalizing exchange...');
      const finalRes = await fetch('/api/tiles/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, tileIdsToExchange, phase: 'finalize' }),
      });
      if (!finalRes.ok) {
        clientLogger.error('exchange finalize failed — rack will re-sync on refresh', { gameId });
      }

      clearPlacements();
      setStatus('Exchange complete. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }"""

if OLD5 not in text:
    print("[FAIL] Patch 5: handleResign anchor not found")
    sys.exit(1)
text = text.replace(OLD5, NEW5, 1)
print("[OK] Patch 5: added handleExchange function")

# ---------------------------------------------------------------------------
# 6. Replace disabled Exchange button with working one
# ---------------------------------------------------------------------------
OLD6 = """\
                  <Button variant="secondary" disabled title="Exchange UI coming next phase">
                    <ArrowLeftRight size={16} /> Exchange
                  </Button>"""

NEW6 = """\
                  <Button
                    variant="secondary"
                    onClick={() => setExchangeOpen(true)}
                    disabled={busy || Object.keys(placements).length > 0}
                    title={Object.keys(placements).length > 0 ? 'Clear board placements before exchanging' : 'Exchange tiles'}
                  >
                    <ArrowLeftRight size={16} /> Exchange
                  </Button>"""

if OLD6 not in text:
    print("[FAIL] Patch 6: disabled Exchange button not found")
    sys.exit(1)
text = text.replace(OLD6, NEW6, 1)
print("[OK] Patch 6: Exchange button is now active")

# ---------------------------------------------------------------------------
# 7. Add ExchangeTilesModal before the closing </> in the return statement
# ---------------------------------------------------------------------------
OLD7 = """\
      <Footer />
    </>
  );
}

function SetupPanel"""

NEW7 = """\
      <Footer />
      <ExchangeTilesModal
        isOpen={exchangeOpen}
        rack={rack}
        placedTileIds={placedTileIds}
        tileBagRemaining={tileBagRemaining}
        busy={busy}
        onClose={() => setExchangeOpen(false)}
        onConfirm={handleExchange}
      />
    </>
  );
}

function SetupPanel"""

if OLD7 not in text:
    print("[FAIL] Patch 7: Footer / SetupPanel boundary not found")
    sys.exit(1)
text = text.replace(OLD7, NEW7, 1)
print("[OK] Patch 7: ExchangeTilesModal added to JSX")

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
TARGET.write_text(text, encoding="utf-8")
added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] Wrote {TARGET} (+{added} lines)")
print("[DONE] All 7 patches applied.")
