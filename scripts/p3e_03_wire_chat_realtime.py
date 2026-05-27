"""
Phase 3E+3G – Script 3
Patches game/[gameId]/page.tsx to:
  - Add ChatPanel import + render it in the aside
  - Add useRealtime import + replace 7s polling with realtime + 30s fallback
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
original = text

# 1. Add ChatPanel import
OLD1 = "import { ChallengeModal } from '@/components/scrabble/ChallengeModal';"
NEW1 = """\
import { ChallengeModal } from '@/components/scrabble/ChallengeModal';
import { ChatPanel } from '@/components/scrabble/ChatPanel';"""
if OLD1 not in text: print("[FAIL] Patch 1"); sys.exit(1)
text = text.replace(OLD1, NEW1, 1)
print("[OK] Patch 1: added ChatPanel import")

# 2. Add useRealtime import after useWalletAuth
OLD2 = "import { useWalletAuth } from '@/hooks/useWalletAuth';"
NEW2 = """\
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useRealtime } from '@/hooks/useRealtime';"""
if OLD2 not in text: print("[FAIL] Patch 2"); sys.exit(1)
text = text.replace(OLD2, NEW2, 1)
print("[OK] Patch 2: added useRealtime import")

# 3. Add useRealtime call after the refresh useEffect (replace 7s poll with 30s + realtime)
OLD3 = """\
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 7000);
    return () => clearInterval(t);
  }, [refresh]);"""
NEW3 = """\
  // Realtime subscription fires refresh immediately on any game row change.
  // The 30s interval is a fallback for environments where realtime is unavailable.
  useRealtime(gameId, refresh);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);"""
if OLD3 not in text: print("[FAIL] Patch 3"); sys.exit(1)
text = text.replace(OLD3, NEW3, 1)
print("[OK] Patch 3: added useRealtime + switched polling to 30s fallback")

# 4. Add ChatPanel to the aside (after the move history card)
OLD4 = """\
            </aside>
          </div>
        )}
      </main>"""
NEW4 = """\
              <ChatPanel
                genlayerGameId={gameId}
                walletAddress={walletAddress}
              />
            </aside>
          </div>
        )}
      </main>"""
if OLD4 not in text: print("[FAIL] Patch 4"); sys.exit(1)
text = text.replace(OLD4, NEW4, 1)
print("[OK] Patch 4: added ChatPanel to aside")

TARGET.write_text(text, encoding="utf-8")
added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] Wrote {TARGET} (+{added} lines)")
print("[DONE] All 4 patches applied.")
