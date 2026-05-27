"""
Switches the project from pnpm workspaces to npm workspaces for Vercel deploy.

Changes:
  package.json (root)       — add workspaces, switch packageManager to npm
  apps/web/package.json     — workspace:* → *
  vercel.json               — use npm ci + npm run build
  pnpm-lock.yaml            — deleted
  pnpm-workspace.yaml       — deleted
"""
import pathlib, json, os

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# 1. Root package.json — add workspaces, switch to npm
# ---------------------------------------------------------------------------
ROOT_PKG = ROOT / "package.json"
pkg = json.loads(ROOT_PKG.read_text(encoding="utf-8"))

pkg["workspaces"] = ["apps/*", "packages/*"]
pkg["packageManager"] = "npm@10.9.2"
pkg["engines"] = {"node": ">=20.0.0", "npm": ">=10.0.0"}

ROOT_PKG.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
print("[OK] package.json — npm workspaces added")

# ---------------------------------------------------------------------------
# 2. apps/web/package.json — workspace:* → *
# ---------------------------------------------------------------------------
WEB_PKG = ROOT / "apps" / "web" / "package.json"
web = WEB_PKG.read_text(encoding="utf-8")
web = web.replace('"workspace:*"', '"*"')
WEB_PKG.write_text(web, encoding="utf-8")
print("[OK] apps/web/package.json — workspace:* to *")

# ---------------------------------------------------------------------------
# 3. vercel.json — npm ci, deploy from apps/web root dir context
# ---------------------------------------------------------------------------
VERCEL = ROOT / "vercel.json"
vercel_cfg = {
    "framework": "nextjs",
    "installCommand": "npm ci",
    "buildCommand": "npm run build --workspace=@wordcourt/web",
    "outputDirectory": "apps/web/.next",
    "devCommand": "npm run dev --workspace=@wordcourt/web"
}
VERCEL.write_text(json.dumps(vercel_cfg, indent=2) + "\n", encoding="utf-8")
print("[OK] vercel.json — switched to npm ci")

# ---------------------------------------------------------------------------
# 4. Remove pnpm files
# ---------------------------------------------------------------------------
for f in ["pnpm-lock.yaml", "pnpm-workspace.yaml"]:
    p = ROOT / f
    if p.exists():
        p.unlink()
        print(f"[OK] Deleted {f}")

print("\n[DONE] Run: npm install   (generates package-lock.json)")
