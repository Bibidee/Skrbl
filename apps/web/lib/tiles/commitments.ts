/**
 * Tile-bag and rack commitments. The contract trust model (PDF section 8)
 * stores only commitments on-chain. Private tiles live in Supabase, the
 * commitments here let GenLayer audit-verify the bag and racks later.
 *
 *   bag_commitment   = sha256(secret || initial_bag_order_joined)
 *   rack_commitment  = sha256(secret || wallet || tiles_joined || version)
 *
 * Cryptographic strength is sufficient for a casual game. A future hardening
 * pass can replace these with Pedersen / Poseidon commitments or a real
 * encrypted-tile scheme without changing any of the call sites.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { assertServerConfigured, serverEnv } from '../env';

function secret(): string {
  return assertServerConfigured('TILE_COMMITMENT_SECRET', serverEnv.TILE_COMMITMENT_SECRET);
}

export function hashBagCommitment(orderedBag: string[]): string {
  const h = createHash('sha256');
  h.update(secret());
  h.update('|bag|');
  h.update(orderedBag.join(','));
  return '0x' + h.digest('hex');
}

export function hashRackCommitment(
  walletAddress: string,
  tiles: ReadonlyArray<{ letter: string; isBlank: boolean }>,
  version: number,
): string {
  const h = createHash('sha256');
  h.update(secret());
  h.update('|rack|');
  h.update(walletAddress.toLowerCase());
  h.update('|');
  h.update(tiles.map((t) => (t.isBlank ? '_' : t.letter.toUpperCase())).join(','));
  h.update('|v');
  h.update(String(version));
  return '0x' + h.digest('hex');
}

export function hashExchangeCommitment(
  walletAddress: string,
  returnedTiles: ReadonlyArray<string>,
  newTiles: ReadonlyArray<string>,
): string {
  const h = createHash('sha256');
  h.update(secret());
  h.update('|exchange|');
  h.update(walletAddress.toLowerCase());
  h.update('|out|');
  h.update(returnedTiles.join(','));
  h.update('|in|');
  h.update(newTiles.join(','));
  return '0x' + h.digest('hex');
}
