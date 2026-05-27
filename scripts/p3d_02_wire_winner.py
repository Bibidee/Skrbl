"""
Phase 3D – Script 2
Patches game/[gameId]/page.tsx to wire WinnerModal.

Changes:
  1. Add WinnerModal import
  2. Add winnerDismissed state
  3. Auto-show modal when game completes (useEffect on game.status)
  4. Add <WinnerModal> to JSX
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
original = text

# 1. Add WinnerModal import
OLD1 = "import { ChallengeModal } from '@/components/scrabble/ChallengeModal';"
NEW1 = """\
import { ChallengeModal } from '@/components/scrabble/ChallengeModal';
import { WinnerModal } from '@/components/scrabble/WinnerModal';"""
if OLD1 not in text: print("[FAIL] Patch 1"); sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: added WinnerModal import")

# 2. Add useRouter import (it's already there from the original file, skip)
# Add winnerDismissed state
OLD2 = "  const [challengeOpen, setChallengeOpen] = useState(false);"
NEW2 = """\
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);"""
if OLD2 not in text: print("[FAIL] Patch 2"); sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: added winnerDismissed state")

# 3. Add <WinnerModal> to JSX before <ChallengeModal>
OLD3 = """\
      <ChallengeModal
        isOpen={challengeOpen}"""
NEW3 = """\
      <WinnerModal
        isOpen={game?.status === 'completed' && !winnerDismissed}
        winner={game?.winner ?? null}
        players={game ? game.players.map((p, i) => ({ walletAddress: p, score: game.scores[p] ?? 0, seatIndex: i })) : []}
        endReason={game?.end_reason ?? null}
        walletAddress={walletAddress}
        onClose={() => setWinnerDismissed(true)}
        onBackToLobby={() => router.push('/lobby')}
      />
      <ChallengeModal
        isOpen={challengeOpen}"""
if OLD3 not in text: print("[FAIL] Patch 3"); sys.exit(1)
text = text.replace(OLD3, NEW3, 1)
print("[OK] Patch 3: added WinnerModal to JSX")

TARGET.write_text(text, encoding="utf-8")
added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] Wrote {TARGET} (+{added} lines)")
print("[DONE] All 3 patches applied.")
