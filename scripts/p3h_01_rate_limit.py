"""
Phase 3H – Script 1
Creates apps/web/lib/rate-limit/index.ts

In-memory sliding-window rate limiter (per-key, e.g. IP or wallet address).
Works within a single process instance. For production at scale, swap the
Map for a Redis/KV store.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "lib" / "rate-limit" / "index.ts"
TARGET.parent.mkdir(parents=True, exist_ok=True)

CONTENT = """\
/**
 * Sliding-window in-memory rate limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check('wallet:0xabc');
 *   if (!result.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
 *
 * Each distinct key (IP address, wallet address, etc.) gets its own bucket.
 * Old entries are evicted lazily when the bucket is checked.
 *
 * In serverless deployments each cold-start resets all counters — this is
 * acceptable for abuse prevention at the MVP stage. Migrate to a Redis-backed
 * limiter (Upstash, Vercel KV) before production traffic ramp.
 */

type Bucket = { timestamps: number[] };

type Options = {
  /** Rolling window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  max: number;
};

type CheckResult = {
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Epoch ms when the oldest request in the window expires. */
  resetAt: number;
};

export function createRateLimiter(options: Options) {
  const { windowMs, max } = options;
  const buckets = new Map<string, Bucket>();

  // Purge buckets that haven't been touched in 2× the window to avoid leaks.
  let lastPurge = Date.now();
  function maybePurge(now: number) {
    if (now - lastPurge < windowMs * 2) return;
    for (const [key, bucket] of buckets) {
      if (bucket.timestamps.length === 0 || now - bucket.timestamps[bucket.timestamps.length - 1]! > windowMs * 2) {
        buckets.delete(key);
      }
    }
    lastPurge = now;
  }

  return {
    check(key: string): CheckResult {
      const now = Date.now();
      maybePurge(now);

      if (!buckets.has(key)) buckets.set(key, { timestamps: [] });
      const bucket = buckets.get(key)!;

      // Evict timestamps outside the window.
      const cutoff = now - windowMs;
      bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

      const count = bucket.timestamps.length;
      const allowed = count < max;
      const resetAt = bucket.timestamps[0] ? bucket.timestamps[0] + windowMs : now + windowMs;

      if (allowed) {
        bucket.timestamps.push(now);
      }

      return { allowed, remaining: Math.max(0, max - count - (allowed ? 1 : 0)), resetAt };
    },

    reset(key: string) {
      buckets.delete(key);
    },
  };
}

// Shared limiters for the tile-mutation endpoints.
// 10 calls per minute per wallet — generous for real gameplay, tight for bots.
export const tileOpLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// 3 deal operations per 10 minutes per wallet.
export const dealLimiter = createRateLimiter({ windowMs: 600_000, max: 3 });
"""

TARGET.write_text(CONTENT, encoding="utf-8")
print(f"[OK] Created {TARGET}")
