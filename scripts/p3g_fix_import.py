import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "hooks" / "useRealtime.ts"
text = TARGET.read_text(encoding="utf-8")
OLD = "import { getBrowserSupabase } from '@/lib/supabase';"
NEW = "import { getBrowserSupabase } from '@/lib/supabase/browser';"
if OLD not in text: print("[FAIL]"); sys.exit(1)
text = text.replace(OLD, NEW, 1)
TARGET.write_text(text, encoding="utf-8")
print("[OK] useRealtime: fixed import to use browser client directly")
