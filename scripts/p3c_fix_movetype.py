import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
OLD = "game.last_move.moveType === 'word'"
NEW = "game.last_move.moveType === 'play_word'"
if OLD not in text: print("[FAIL]"); sys.exit(1)
text = text.replace(OLD, NEW, 1)
TARGET.write_text(text, encoding="utf-8")
print("[OK] Fixed moveType 'word' -> 'play_word'")
