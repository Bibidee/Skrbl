"""
Creates:
  apps/web/lib/dictionary/index.ts  — basic word-format validator
  apps/web/lib/crypto/index.ts      — client-side secure random + commitment verify
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- dictionary ---
DICT = ROOT / "apps" / "web" / "lib" / "dictionary" / "index.ts"
DICT.parent.mkdir(parents=True, exist_ok=True)

DICT_CONTENT = """\
/**
 * Local word-format validation.
 *
 * Does NOT validate against a word list — that is GenLayer's job (LLM-based).
 * These checks catch obviously malformed submissions before hitting the
 * GenLayer contract, saving the user a failed transaction fee.
 */

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 15; // longest Scrabble word that fits on a 15×15 board

export type WordValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** Checks word format only (length, characters). No dictionary lookup. */
export function validateWordFormat(word: string): WordValidation {
  if (!word || word.length < MIN_WORD_LENGTH) {
    return { valid: false, reason: `Word must be at least ${MIN_WORD_LENGTH} letters.` };
  }
  if (word.length > MAX_WORD_LENGTH) {
    return { valid: false, reason: `Word exceeds max length of ${MAX_WORD_LENGTH}.` };
  }
  if (!/^[A-Za-z]+$/.test(word)) {
    return { valid: false, reason: 'Word must contain only letters A–Z.' };
  }
  return { valid: true };
}

/** Validates all formed words in a move. Returns the first failure, or valid. */
export function validateFormedWords(words: string[]): WordValidation {
  if (words.length === 0) {
    return { valid: false, reason: 'No words formed. At least one word must be created.' };
  }
  for (const word of words) {
    const result = validateWordFormat(word);
    if (!result.valid) return result;
  }
  return { valid: true };
}
"""

DICT.write_text(DICT_CONTENT, encoding="utf-8")
print(f"[OK] Created {DICT}")

# --- crypto ---
CRYPTO = ROOT / "apps" / "web" / "lib" / "crypto" / "index.ts"
CRYPTO.parent.mkdir(parents=True, exist_ok=True)

CRYPTO_CONTENT = """\
/**
 * Client-side cryptographic helpers.
 *
 * Uses the Web Crypto API (available in all modern browsers and Node ≥ 15).
 * No secrets are generated or stored here — this module is for generating
 * nonces and verifying commitments on the client.
 */

/** Generates `byteCount` cryptographically random bytes and returns them as hex. */
export function generateSecureHex(byteCount = 16): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes an arbitrary string using SHA-256 via the Web Crypto API.
 * Returns a lowercase hex string (no 0x prefix).
 */
export async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recomputes a rack commitment on the client to verify the server gave
 * us a correct commitment. The secret must be passed in (it is NOT stored
 * client-side in production — this is only useful in tests or admin tools).
 */
export async function verifyRackCommitment(
  walletAddress: string,
  tiles: ReadonlyArray<{ letter: string; isBlank: boolean }>,
  version: number,
  secret: string,
  claimed: string,
): Promise<boolean> {
  const tileStr = tiles.map((t) => (t.isBlank ? '_' : t.letter.toUpperCase())).join(',');
  const payload = `${secret}|rack|${walletAddress.toLowerCase()}|${tileStr}|v${version}`;
  const hash = await sha256Hex(payload);
  return `0x${hash}` === claimed;
}
"""

CRYPTO.write_text(CRYPTO_CONTENT, encoding="utf-8")
print(f"[OK] Created {CRYPTO}")
