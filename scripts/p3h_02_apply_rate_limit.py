"""
Phase 3H – Script 2
Applies rate limiting to deal, draw, and exchange API routes.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

def patch(file: pathlib.Path, limiter_import: str, old_guard: str, new_guard: str, label: str):
    text = file.read_text(encoding="utf-8")
    # Add import after the last existing import
    if limiter_import not in text:
        old_last_import = "import { requireWallet, UnauthorisedError } from '@/lib/auth/session';"
        new_last_import = old_last_import + "\n" + limiter_import
        if old_last_import not in text:
            print(f"[FAIL] {label}: auth import anchor not found")
            sys.exit(1)
        text = text.replace(old_last_import, new_last_import, 1)

    if old_guard not in text:
        print(f"[FAIL] {label}: guard anchor not found")
        sys.exit(1)
    text = text.replace(old_guard, new_guard, 1)
    file.write_text(text, encoding="utf-8")
    print(f"[OK] {label}")

# --- deal route ---
DEAL = ROOT / "apps" / "web" / "app" / "api" / "tiles" / "deal" / "route.ts"
patch(
    DEAL,
    "import { dealLimiter } from '@/lib/rate-limit';",
    "    const wallet = await requireWallet();\n    const json = (await req.json().catch(() => ({}))) as unknown;",
    """\
    const wallet = await requireWallet();
    const rl = dealLimiter.check(`deal:${wallet}`);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
    }
    const json = (await req.json().catch(() => ({}))) as unknown;""",
    "deal route: added rate limit",
)

# --- draw route ---
DRAW = ROOT / "apps" / "web" / "app" / "api" / "tiles" / "draw" / "route.ts"
patch(
    DRAW,
    "import { tileOpLimiter } from '@/lib/rate-limit';",
    "    const wallet = await requireWallet();\n    const json = (await req.json().catch(() => ({}))) as unknown;",
    """\
    const wallet = await requireWallet();
    const rl = tileOpLimiter.check(`draw:${wallet}`);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
    }
    const json = (await req.json().catch(() => ({}))) as unknown;""",
    "draw route: added rate limit",
)

# --- exchange route ---
EXCHANGE = ROOT / "apps" / "web" / "app" / "api" / "tiles" / "exchange" / "route.ts"
patch(
    EXCHANGE,
    "import { tileOpLimiter } from '@/lib/rate-limit';",
    "    const wallet = await requireWallet();\n    const json = (await req.json().catch(() => ({}))) as unknown;",
    """\
    const wallet = await requireWallet();
    const rl = tileOpLimiter.check(`exchange:${wallet}`);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
    }
    const json = (await req.json().catch(() => ({}))) as unknown;""",
    "exchange route: added rate limit",
)

print("[DONE] Rate limiting applied to deal, draw, exchange.")
