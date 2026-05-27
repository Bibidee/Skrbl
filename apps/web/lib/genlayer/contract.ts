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
import type { WalletClient } from 'viem';
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
  walletClient: WalletClient,
  functionName: string,
  args: readonly unknown[],
): Promise<WriteResult> {
  const client = await getWriteClient(walletClient);
  const address = getContractAddress();
  const hash = await client.writeContract({ address, functionName, args });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`GENLAYER_TX_FAILED: ${functionName} status=${receipt.status}`);
  }
  // The contract returns a JSON-stringified receipt in receipt.data (genlayer-js
  // surfaces it under varying property names by version). Fall back to {}.
  let parsed: Record<string, unknown> = {};
  const candidate =
    (receipt as Record<string, unknown>).result ??
    (receipt as Record<string, unknown>).output ??
    (receipt as Record<string, unknown>).returnValue ??
    null;
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

export function createGame(walletClient: WalletClient, args: CreateGameArgs): Promise<WriteResult> {
  if (!isValidModeTheme(args.wordMode, args.theme)) {
    throw new Error(
      `INVALID_MODE_THEME: word_mode=${args.wordMode} theme=${args.theme}. ` +
        `themed requires crypto/genlayer; classic/custom require theme=none.`,
    );
  }
  return writeCall(walletClient, 'create_game', [
    args.gameId,
    args.wordMode,
    args.theme,
    BigInt(args.maxPlayers),
    args.rackCommitment,
  ]);
}

export function joinGame(walletClient: WalletClient, args: JoinGameArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'join_game', [args.gameId, args.rackCommitment]);
}

export function commitTileBag(walletClient: WalletClient, args: CommitTileBagArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'commit_tile_bag', [args.gameId, args.bagCommitment]);
}

export function commitRack(walletClient: WalletClient, args: CommitRackArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'commit_rack', [args.gameId, args.rackCommitment]);
}

export function startGame(walletClient: WalletClient, args: StartGameArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'start_game', [args.gameId]);
}

export function submitMove(walletClient: WalletClient, args: SubmitMoveArgs): Promise<WriteResult> {
  // Contract takes JSON-string placements + claimed_words.
  const placementsPayload = args.placements.map((p) => ({
    row: p.row,
    col: p.col,
    letter: p.letter.toUpperCase(),
    blank: p.isBlank,
  }));
  return writeCall(walletClient, 'submit_move', [
    args.gameId,
    JSON.stringify(placementsPayload),
    JSON.stringify(args.claimedWords.map((w) => w.toUpperCase())),
    BigInt(args.claimedScore),
    args.nextRackCommitment,
  ]);
}

export function challengeMove(
  walletClient: WalletClient,
  args: ChallengeMoveArgs,
): Promise<WriteResult> {
  return writeCall(walletClient, 'challenge_move', [
    args.gameId,
    BigInt(args.moveNumber),
    args.reason,
  ]);
}

export function resolveChallenge(
  walletClient: WalletClient,
  args: ResolveChallengeArgs,
): Promise<WriteResult> {
  return writeCall(walletClient, 'resolve_challenge', [args.gameId, args.challengeId]);
}

export function passTurn(walletClient: WalletClient, args: PassTurnArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'pass_turn', [args.gameId, args.nextRackCommitment]);
}

export function recordExchange(
  walletClient: WalletClient,
  args: RecordExchangeArgs,
): Promise<WriteResult> {
  return writeCall(walletClient, 'record_exchange', [
    args.gameId,
    args.exchangeCommitment,
    args.nextRackCommitment,
  ]);
}

export function resignGame(walletClient: WalletClient, args: ResignGameArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'resign_game', [args.gameId]);
}

export function forfeitGame(
  walletClient: WalletClient,
  args: ResignGameArgs,
): Promise<WriteResult> {
  // Alias on the contract; surface both for clarity at call sites.
  return writeCall(walletClient, 'forfeit_game', [args.gameId]);
}

export function endGame(walletClient: WalletClient, args: EndGameArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'end_game', [args.gameId, args.finalRacksCommitment]);
}

export function cancelGame(walletClient: WalletClient, args: CancelGameArgs): Promise<WriteResult> {
  return writeCall(walletClient, 'cancel_game', [args.gameId]);
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

export async function getGame(gameId: string): Promise<OnChainGame | null> {
  const client = await getReadClient();
  const raw = await client.readContract({
    address: getContractAddress(),
    functionName: 'get_game',
    args: [gameId],
  });
  if (typeof raw !== 'string' || raw === '') return null;
  return JSON.parse(raw) as OnChainGame;
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
