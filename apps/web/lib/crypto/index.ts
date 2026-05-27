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
