"""
Phase 3C – Script 2
Patches game/[gameId]/page.tsx to wire challenge + resolve flow.

Changes:
  1. Add challengeMove + resolveChallenge to genlayer imports
  2. Add ChallengeModal import
  3. Add Gavel icon import
  4. Add challengeOpen state
  5. Add handleChallenge + handleResolveChallenge functions
  6. Add Challenge button for opponents in action bar
  7. Add pending-challenge banner + resolve button for everyone
  8. Add <ChallengeModal> to JSX
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
original = text

# 1. Add Gavel to lucide imports
OLD1 = "import { ArrowLeftRight, Flag, Hammer, Send, SkipForward, Trophy } from 'lucide-react';"
NEW1 = "import { AlertTriangle, ArrowLeftRight, Flag, Gavel, Hammer, Send, SkipForward, Trophy } from 'lucide-react';"
if OLD1 not in text: print("[FAIL] Patch 1"); sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: added AlertTriangle + Gavel to lucide imports")

# 2. Add challengeMove + resolveChallenge to genlayer imports
OLD2 = """\
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
NEW2 = """\
import {
  challengeMove,
  getGame,
  passTurn,
  recordExchange,
  resignGame,
  resolveChallenge,
  startGame,
  submitMove,
  commitTileBag,
  commitRack,
  type OnChainGame,
} from '@/lib/genlayer';"""
if OLD2 not in text: print("[FAIL] Patch 2"); sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: added challengeMove + resolveChallenge imports")

# 3. Add ChallengeModal import after ExchangeTilesModal import
OLD3 = "import { ExchangeTilesModal } from '@/components/scrabble/ExchangeTilesModal';"
NEW3 = """\
import { ChallengeModal } from '@/components/scrabble/ChallengeModal';
import { ExchangeTilesModal } from '@/components/scrabble/ExchangeTilesModal';"""
if OLD3 not in text: print("[FAIL] Patch 3"); sys.exit(1)
text = text.replace(OLD3, NEW3, 1)
print("[OK] Patch 3: added ChallengeModal import")

# 4. Add challengeOpen state after exchangeOpen
OLD4 = "  const [exchangeOpen, setExchangeOpen] = useState(false);"
NEW4 = """\
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);"""
if OLD4 not in text: print("[FAIL] Patch 4"); sys.exit(1)
text = text.replace(OLD4, NEW4, 1)
print("[OK] Patch 4: added challengeOpen state")

# 5. Add handleChallenge + handleResolveChallenge after handleExchange closing brace
OLD5 = """\
  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-10">Loading game…</main>
        <Footer />
      </>
    );
  }"""
NEW5 = """\
  async function handleChallenge(reason: string) {
    if (!walletClient || !game?.last_move) return;
    setBusy(true);
    setError(null);
    setChallengeOpen(false);
    try {
      setStatus('Submitting challenge to GenLayer...');
      await challengeMove(walletClient, {
        gameId,
        moveNumber: game.last_move.moveNumber,
        reason,
      });
      setStatus('Challenge submitted. Waiting for resolution...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function handleResolveChallenge() {
    if (!walletClient || !game?.pending_challenge) return;
    setBusy(true);
    setError(null);
    setChallengeOpen(false);
    try {
      setStatus('Resolving challenge via GenLayer LLM...');
      await resolveChallenge(walletClient, {
        gameId,
        challengeId: game.pending_challenge.challenge_id,
      });
      setStatus('Challenge resolved. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-10">Loading game…</main>
        <Footer />
      </>
    );
  }"""
if OLD5 not in text: print("[FAIL] Patch 5"); sys.exit(1)
text = text.replace(OLD5, NEW5, 1)
print("[OK] Patch 5: added handleChallenge + handleResolveChallenge")

# 6. Add "Challenge" button for opponents + pending challenge banner
# Insert after the "myTurn" action bar closing </div>
OLD6 = """\
              {status && <p className="text-xs text-text-muted">{status}</p>}
              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}"""
NEW6 = """\
              {/* Challenge button: visible to opponents when there's a challengeable last move */}
              {game.status === 'active' && !myTurn && game.last_move && game.last_move.moveType === 'word' && !game.pending_challenge && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setChallengeOpen(true)}
                    disabled={busy}
                  >
                    <Gavel size={14} /> Challenge last move
                  </Button>
                </div>
              )}
              {/* Pending challenge banner — visible to everyone */}
              {game.pending_challenge && (
                <div className="flex items-center justify-between rounded-lg border border-accent-gold/40 bg-accent-gold/5 px-3 py-2">
                  <p className="text-xs text-accent-gold font-semibold flex items-center gap-1">
                    <AlertTriangle size={13} /> Challenge pending on move #{game.pending_challenge.move_number}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setChallengeOpen(true)}
                    disabled={busy}
                  >
                    <Gavel size={13} /> Resolve
                  </Button>
                </div>
              )}
              {status && <p className="text-xs text-text-muted">{status}</p>}
              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}"""
if OLD6 not in text: print("[FAIL] Patch 6"); sys.exit(1)
text = text.replace(OLD6, NEW6, 1)
print("[OK] Patch 6: added Challenge button + pending challenge banner")

# 7. Add <ChallengeModal> before <ExchangeTilesModal> in JSX
OLD7 = """\
      <ExchangeTilesModal
        isOpen={exchangeOpen}"""
NEW7 = """\
      <ChallengeModal
        isOpen={challengeOpen}
        lastMove={game?.last_move ?? null}
        pendingChallenge={game?.pending_challenge ?? null}
        walletAddress={walletAddress}
        busy={busy}
        onClose={() => setChallengeOpen(false)}
        onChallenge={handleChallenge}
        onResolve={handleResolveChallenge}
      />
      <ExchangeTilesModal
        isOpen={exchangeOpen}"""
if OLD7 not in text: print("[FAIL] Patch 7"); sys.exit(1)
text = text.replace(OLD7, NEW7, 1)
print("[OK] Patch 7: added ChallengeModal to JSX")

TARGET.write_text(text, encoding="utf-8")
added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] Wrote {TARGET} (+{added} lines)")
print("[DONE] All 7 patches applied.")
