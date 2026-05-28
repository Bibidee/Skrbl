'use client';

/**
 * Typed wrappers for every call on the deployed WordCourt v0.3.0 contract.
 *
 * Reads (views) return decoded JSON. The Python contract emits JSON strings
 * for the structured ones (get_game, get_board, ...) and primitives for the
 * rest (get_total_games is u256, get_status is str, etc.) - we decode in one
 * place here so call sites stay simple.
 *
 * Writes return both the tx hash and the parsed JSON receipt the contract
 * emitted, so UI code can show "+ 18 points" without an extra round-trip.
 */
import type { PrivateKeyAccount } from 'viem';
import { isValidModeTheme } from '@wordcourt/shared';
import { getContractAddress, getReadClient, getWriteClient } from './client';
import type {
  CancelGameArgs,
  ChallengeMoveArgs,
  CommitRackArgs,
  CommitTileBagArgs,
  CreateGameArgs,
  EndGameArgs,
  JoinGameArgs,
  MovePreview,
  OnChainChallenge,
  OnChainGame,
  OnChainMove,
  PassTurnArgs,
  PlayerStats,
  RecordExchangeArgs,
  ResignGameArgs,
  ResolveChallengeArgs,
  StartGameArgs,
  SubmitMoveArgs,
  WriteResult,
} from './types';

// ---------- Shared helpers ----------

function decodeJsonOrThrow<T>(raw: unknown, fallback?: T): T {
  if (raw === undefined || raw === null || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error('GENLAYER_EMPTY_RESPONSE');
  }
  if (typeof raw !== 'string') {
    // Some clients pre-parse - accept that too.
    return raw as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`GENLAYER_BAD_JSON: ${(e as Error).message}`);
  }
}

async function viewCall<T>(functionName: string, args: readonly unknown[], fallback?: T): Promise<T> {
  const client = await getReadClient();
  const address = getContractAddress();
  const raw = await client.readContract({ address, functionName, args });
  return decodeJsonOrThrow<T>(raw, fallback);
}

async function writeCall(
  account: PrivateKeyAccount,
  functionName: string,
  args: readonly unknown[],
): Promise<WriteResult> {
  const client = await getWriteClient(account);
  const address = getContractAddress();

  // writeContract signs + broadcasts via the wallet and returns the tx hash.
  // Once we have a hash, the move is on its way to GenLayer consensus.
  const hash = await client.writeContract({ address, functionName, args });

  // Wait until the transaction reaches the ACCEPTED decided state. We pass the
  // target status explicitly so we don't block through extra consensus stages.
  //
  // genlayer-js@1.x has a decode bug (`decodeInputData` -> viem RLP) that can
  // throw "RLP string ends with N superfluous bytes" while *reading back* an
  // already-accepted transaction. That decode failure must NOT fail the user's
  // action: the tx is broadcast and GenLayer is the source of truth. We catch
  // it, return the hash with an empty result, and let the caller's refresh()
  // (getGame) read the authoritative outcome.
  let receipt: Record<string, unknown> | null = null;
  try {
    receipt = (await client.waitForTransactionReceipt({
      hash,
      status: 'ACCEPTED',
    })) as Record<string, unknown>;
  } catch (e) {
    const msg = (e as Error).message ?? '';
    const isDecodeBug = /RLP|superfluous bytes|decode/i.test(msg);
    if (!isDecodeBug) {
      // A genuine failure (revert, timeout, rejected signature) — surface it.
      throw e;
    }
    // Known library decode bug after acceptance — proceed with just the hash.
    return { txHash: hash, result: {} };
  }

  // GenLayer status can surface as a string enum ('ACCEPTED' | 'FINALIZED' |
  // 'success') or as a numeric code (ACCEPTED=5, FINALIZED=6). Treat both
  // decided-success forms as success; an `accepted` flag is a secondary signal.
  const rawStatus =
    (receipt.statusName as unknown) ?? (receipt.status as unknown);
  const isSuccess =
    rawStatus === 'success' ||
    rawStatus === 5 ||
    rawStatus === 6 ||
    rawStatus === 'ACCEPTED' ||
    rawStatus === 'FINALIZED' ||
    receipt.accepted === true;

  if (!isSuccess) {
    throw new Error(`GENLAYER_TX_FAILED: ${functionName} status=${String(rawStatus)}`);
  }

  // The contract returns a JSON-stringified result; genlayer-js surfaces it
  // under varying property names by version. Fall back to {}.
  let parsed: Record<string, unknown> = {};
  const candidate =
    receipt.result ?? receipt.output ?? receipt.returnValue ?? null;
  if (typeof candidate === 'string') {
    try {
      parsed = JSON.parse(candidate);
    } catch {
      // ignore parse failures - tx still succeeded.
    }
  } else if (candidate && typeof candidate === 'object') {
    parsed = candidate as Record<string, unknown>;
  }
  return { txHash: hash, result: parsed };
}

// ============================================================
// Write functions (15 - exactly the deployed contract surface)
// ============================================================

export function createGame(account: PrivateKeyAccount, args: CreateGameArgs): Promise<WriteResult> {
  if (!isValidModeTheme(args.wordMode, args.theme)) {
    throw new Error(
      `INVALID_MODE_THEME: word_mode=${args.wordMode} theme=${args.theme}. ` +
        `themed requires crypto/genlayer; classic/custom require theme=none.`,
    );
  }
  return writeCall(account, 'create_game', [
    args.gameId,
    args.wordMode,
    args.theme,
    BigInt(args.maxPlayers),
    args.rackCommitment,
  ]);
}

export function joinGame(account: PrivateKeyAccount, args: JoinGameArgs): Promise<WriteResult> {
  return writeCall(account, 'join_game', [args.gameId, args.rackCommitment]);
}

export function commitTileBag(account: PrivateKeyAccount, args: CommitTileBagArgs): Promise<WriteResult> {
  return writeCall(account, 'commit_tile_bag', [args.gameId, args.bagCommitment]);
}

export function commitRack(account: PrivateKeyAccount, args: CommitRackArgs): Promise<WriteResult> {
  return writeCall(account, 'commit_rack', [args.gameId, args.rackCommitment]);
}

export function startGame(account: PrivateKeyAccount, args: StartGameArgs): Promise<WriteResult> {
  return writeCall(account, 'start_game', [args.gameId]);
}

export function submitMove(account: PrivateKeyAccount, args: SubmitMoveArgs): Promise<WriteResult> {
  // Contract takes JSON-string placements + claimed_words.
  const placementsPayload = args.placements.map((p) => ({
    row: p.row,
    col: p.col,
    letter: p.letter.toUpperCase(),
    blank: p.isBlank,
  }));
  return writeCall(account, 'submit_move', [
    args.gameId,
    JSON.stringify(placementsPayload),
    JSON.stringify(args.claimedWords.map((w) => w.toUpperCase())),
    BigInt(args.claimedScore),
    args.nextRackCommitment,
  ]);
}

export function challengeMove(
  account: PrivateKeyAccount,
  args: ChallengeMoveArgs,
): Promise<WriteResult> {
  return writeCall(account, 'challenge_move', [
    args.gameId,
    BigInt(args.moveNumber),
    args.reason,
  ]);
}

export function resolveChallenge(
  account: PrivateKeyAccount,
  args: ResolveChallengeArgs,
): Promise<WriteResult> {
  return writeCall(account, 'resolve_challenge', [args.gameId, args.challengeId]);
}

export function passTurn(account: PrivateKeyAccount, args: PassTurnArgs): Promise<WriteResult> {
  return writeCall(account, 'pass_turn', [args.gameId, args.nextRackCommitment]);
}

export function recordExchange(
  account: PrivateKeyAccount,
  args: RecordExchangeArgs,
): Promise<WriteResult> {
  return writeCall(account, 'record_exchange', [
    args.gameId,
    args.exchangeCommitment,
    args.nextRackCommitment,
  ]);
}

export function resignGame(account: PrivateKeyAccount, args: ResignGameArgs): Promise<WriteResult> {
  return writeCall(account, 'resign_game', [args.gameId]);
}

export function forfeitGame(
  account: PrivateKeyAccount,
  args: ResignGameArgs,
): Promise<WriteResult> {
  // Alias on the contract; surface both for clarity at call sites.
  return writeCall(account, 'forfeit_game', [args.gameId]);
}

export function endGame(account: PrivateKeyAccount, args: EndGameArgs): Promise<WriteResult> {
  return writeCall(account, 'end_game', [args.gameId, args.finalRacksCommitment]);
}

export function cancelGame(account: PrivateKeyAccount, args: CancelGameArgs): Promise<WriteResult> {
  return writeCall(account, 'cancel_game', [args.gameId]);
}

// =============================================================
// View functions (16 - exactly the deployed contract surface)
// =============================================================

export async function getTotalGames(): Promise<number> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_total_games',
  });
  return typeof raw === 'bigint' ? Number(raw) : Number(raw);
}

/**
 * Maps a single move record's snake_case keys (what the GenLayer contract
 * emits) to the camelCase shape the UI types expect. Defensive — leaves
 * camelCase keys alone if both are present, so it's safe to run twice.
 */
function normaliseMove(m: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!m || typeof m !== 'object') return null;
  return {
    moveNumber: m.moveNumber ?? m.move_number ?? 0,
    playerWallet: m.playerWallet ?? m.player_wallet ?? '',
    moveType: m.moveType ?? m.move_type ?? 'play_word',
    placements: m.placements ?? [],
    formedWords: m.formedWords ?? m.formed_words ?? [],
    officialScore: m.officialScore ?? m.official_score,
    reasoning: m.reasoning,
    txHash: m.txHash ?? m.tx_hash,
    status: m.status,
    rack_commitment_after: m.rack_commitment_after,
    word_details: m.word_details,
  };
}

export async function getGame(gameId: string): Promise<OnChainGame | null> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_game',
    args: [gameId],
  });
  if (typeof raw !== 'string' || raw === '') return null;
  const game = JSON.parse(raw) as OnChainGame & Record<string, unknown>;

  // Contract emits snake_case for move records; UI types are camelCase.
  // Normalise at the boundary so consumers don't crash on undefined fields.
  if (game.last_move) {
    game.last_move = normaliseMove(game.last_move as Record<string, unknown>) as OnChainGame['last_move'];
  }
  if (Array.isArray(game.move_history)) {
    game.move_history = game.move_history.map(
      (m) => normaliseMove(m as Record<string, unknown>),
    ) as OnChainGame['move_history'];
  }

  return game;
}

export async function getStatus(gameId: string): Promise<string> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_status',
    args: [gameId],
  });
  return String(raw ?? 'NOT_FOUND');
}

export function getBoard(gameId: string) {
  return viewCall<OnChainGame['board']>('get_board', [gameId], {});
}

export function getScores(gameId: string) {
  return viewCall<Record<string, number>>('get_scores', [gameId], {});
}

export async function getCurrentTurn(gameId: string): Promise<string> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_current_turn',
    args: [gameId],
  });
  return String(raw ?? '');
}

export function getMoveHistory(gameId: string) {
  return viewCall<OnChainMove[]>('get_move_history', [gameId], []);
}

export async function getLastMove(gameId: string): Promise<OnChainMove | null> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_last_move',
    args: [gameId],
  });
  if (typeof raw !== 'string' || raw === '') return null;
  return JSON.parse(raw) as OnChainMove;
}

export function getChallenges(gameId: string) {
  return viewCall<OnChainChallenge[]>('get_challenges', [gameId], []);
}

export async function getPendingChallenge(gameId: string): Promise<OnChainChallenge | null> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_pending_challenge',
    args: [gameId],
  });
  if (typeof raw !== 'string' || raw === '') return null;
  return JSON.parse(raw) as OnChainChallenge;
}

export async function getWinner(gameId: string): Promise<string> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_winner',
    args: [gameId],
  });
  return String(raw ?? '');
}

export function getPlayerStats(wallet: string) {
  return viewCall<PlayerStats>('get_player_stats', [wallet.toLowerCase()]);
}

export function getLeaderboard(limit = 50) {
  return viewCall<PlayerStats[]>('get_leaderboard', [BigInt(limit)], []);
}

export function getRecentGames(limit = 20) {
  return viewCall<OnChainGame[]>('get_recent_games', [BigInt(limit)], []);
}

export function getOpenGames(limit = 50) {
  return viewCall<OnChainGame[]>('get_open_games', [BigInt(limit)], []);
}

/**
 * preview_move is a *view* on the deployed contract. It runs the same placement
 * + word + scoring validation as submit_move without persisting anything, so
 * the UI can show the official preview score before the player commits the tx.
 *
 * Important: preview_move's word validation in classic/custom uses
 * gl.vm.run_nondet_unsafe and is therefore slow (LLM round-trip x validators).
 * For instant local preview, use the deterministic preview in
 * `apps/web/lib/board/score.ts` instead and reserve this call for the moment
 * the player hits "Submit".
 */
export function previewMove(gameId: string, placements: SubmitMoveArgs['placements']) {
  const payload = placements.map((p) => ({
    row: p.row,
    col: p.col,
    letter: p.letter.toUpperCase(),
    blank: p.isBlank,
  }));
  return viewCall<MovePreview>('preview_move', [gameId, JSON.stringify(payload)]);
}
