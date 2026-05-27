'use client';

import * as React from 'react';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWalletClient } from 'wagmi';
import { AlertTriangle, ArrowLeftRight, Flag, Gavel, Hammer, Send, SkipForward, Trophy } from 'lucide-react';
import {
  cellKey,
  isValidModeTheme,
  type RackTile,
} from '@wordcourt/shared';
import {
  challengeMove,
  getGame,
  joinGame,
  passTurn,
  recordExchange,
  resignGame,
  resolveChallenge,
  startGame,
  submitMove,
  commitTileBag,
  commitRack,
  type OnChainGame,
} from '@/lib/genlayer';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { ScrabbleBoard } from '@/components/scrabble/ScrabbleBoard';
import { TileRack } from '@/components/scrabble/TileRack';
import { ScorePanel } from '@/components/scrabble/ScorePanel';
import { ChallengeModal } from '@/components/scrabble/ChallengeModal';
import { GenLayerProofPanel } from '@/components/scrabble/GenLayerProofPanel';
import { ChatPanel } from '@/components/scrabble/ChatPanel';
import { WinnerModal } from '@/components/scrabble/WinnerModal';
import { ExchangeTilesModal } from '@/components/scrabble/ExchangeTilesModal';
import { placementsArray, usePlacementStore } from '@/store/usePlacementStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { clientLogger } from '@/lib/logger/client';

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { walletAddress, signIn } = useWalletAuth();
  const placements = usePlacementStore((s) => s.temporary);
  const selectedTileId = usePlacementStore((s) => s.selectedTileId);
  const selectTile = usePlacementStore((s) => s.selectTile);
  const placeAt = usePlacementStore((s) => s.placeAt);
  const removeAt = usePlacementStore((s) => s.removeAt);
  const clearPlacements = usePlacementStore((s) => s.clear);

  const [game, setGame] = useState<OnChainGame | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [rackCommitment, setRackCommitment] = useState<string>('');
  const [tileBagRemaining, setTileBagRemaining] = useState<number>(0);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);

  // Pull game state from GenLayer (source of truth).
  const refresh = useCallback(async () => {
    setError(null);
    try {
      const g = await getGame(gameId);
      setGame(g);
      if (walletAddress && g) {
        const res = await fetch(`/api/racks/${g.game_id}`, { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { tiles: RackTile[]; rackCommitment: string | null; tileBagRemaining: number };
          setRack(data.tiles ?? []);
          setRackCommitment(data.rackCommitment ?? '');
          setTileBagRemaining(data.tileBagRemaining ?? 0);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [gameId, walletAddress]);

  // Realtime subscription fires refresh immediately on any game row change.
  // The 30s interval is a fallback for environments where realtime is unavailable.
  useRealtime(gameId, refresh);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const placedTileIds = useMemo(() => new Set(Object.values(placements).map((p) => p.tileId)), [placements]);

  const myTurn =
    !!game &&
    !!walletAddress &&
    game.status === 'active' &&
    game.players[game.current_turn_index]?.toLowerCase() === walletAddress;

  function handleSquareClick(row: number, col: number) {
    const key = cellKey(row, col);
    if (game?.board?.[key]) return; // committed tile - cannot overwrite
    if (placements[key]) {
      removeAt(row, col);
      return;
    }
    if (!selectedTileId) return;
    const tile = rack.find((t) => t.id === selectedTileId);
    if (!tile) return;
    let blankLetter: string | undefined;
    if (tile.isBlank) {
      const choice = window.prompt('Pick a letter for this blank tile (A-Z):')?.toUpperCase() ?? '';
      if (!/^[A-Z]$/.test(choice)) return;
      blankLetter = choice;
    }
    placeAt(row, col, tile, blankLetter);
  }

  // --- Setup phase: creator deals + commits + starts. ---
  const handleJoin = useCallback(async () => {
    if (!walletClient || !walletAddress || !game) return;
    setError(null);
    setBusy(true);
    setStatus('Joining game on GenLayer...');
    try {
      // Placeholder commitment — replaced by /api/tiles/deal once the bag is dealt.
      const rackCommitment = `pending_${gameId}_${walletAddress.slice(2, 10)}`;
      await joinGame(walletClient, { gameId, rackCommitment });

      // Mirror the join into Supabase so /api/tiles/deal sees both seats.
      // The route accepts either a room_code or a genlayer_game_id.
      setStatus('Syncing seat with Supabase...');
      const joinRes = await fetch(`/api/rooms/${gameId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!joinRes.ok) {
        const detail = (await joinRes.json().catch(() => ({}))) as { error?: string };
        // Joined on-chain even if mirror failed; surface but don't block.
        clientLogger.warn('supabase join mirror failed', { error: detail.error });
      }

      setStatus('Joined! Waiting for the creator to start the game...');
      await refresh();
    } catch (e) {
      clientLogger.error('join game failed', { msg: (e as Error).message });
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [walletClient, walletAddress, game, gameId, refresh]);

  async function handleDealAndStart() {
    if (!walletClient || !game) return;
    if (!walletAddress) {
      const ok = await signIn();
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus('Dealing tiles via Supabase...');
      const roomRes = await fetch(`/api/rooms?lookup=${gameId}`, { cache: 'no-store' });
      // The deal endpoint also needs roomCode; pull from /api/rooms list.
      const roomsData = (await roomRes.json()) as { rooms: Array<{ room_code: string; genlayer_game_id: string }> };
      const room = roomsData.rooms.find((r) => r.genlayer_game_id === gameId);
      if (!room) throw new Error('room_lookup_failed');

      const dealRes = await fetch('/api/tiles/deal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, roomCode: room.room_code }),
      });
      if (!dealRes.ok) {
        const detail = (await dealRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`deal_failed:${detail.error ?? dealRes.status}`);
      }
      const deal = (await dealRes.json()) as {
        bagCommitment: string;
        rackCommitments: Array<{ walletAddress: string; rackCommitment: string }>;
      };

      setStatus('Submitting commit_tile_bag to GenLayer...');
      await commitTileBag(walletClient, { gameId, bagCommitment: deal.bagCommitment });

      setStatus('Submitting commit_rack for each player...');
      for (const rc of deal.rackCommitments) {
        await commitRack(walletClient, { gameId, rackCommitment: rc.rackCommitment });
      }

      setStatus('Submitting start_game...');
      await startGame(walletClient, { gameId });
      setStatus(null);
      await refresh();
    } catch (e) {
      clientLogger.error('deal+start failed', { msg: (e as Error).message });
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitMove() {
    if (!walletClient || !game) return;
    const arr = placementsArray(placements);
    if (arr.length === 0) {
      setError('Place at least one tile.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Step 1: get official score and formed words from the contract preview
      setStatus('Previewing move...');
      const { previewMove } = await import('@/lib/genlayer');
      const preview = await previewMove(gameId, arr);

      // Step 2: prepare draw — compute new rack commitment WITHOUT writing to DB.
      // We need this commitment before calling GenLayer so the contract can verify it.
      setStatus('Preparing tile draw...');
      const placedIds = arr.map((p) => p.tileId);
      const prepRes = await fetch('/api/tiles/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, placedTileIds: placedIds, phase: 'prepare' }),
      });
      if (!prepRes.ok) {
        const detail = (await prepRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`draw_prepare_failed:${detail.error ?? prepRes.status}`);
      }
      const drawPrep = (await prepRes.json()) as {
        newRack: import('@wordcourt/shared').RackTile[];
        newRackCommitment: string;
        drawnCount: number;
        tileBagRemaining: number;
      };

      // Step 3: submit the move to GenLayer with the real next rack commitment
      setStatus('Submitting move to GenLayer (validating words + score)...');
      const result = await submitMove(walletClient, {
        gameId,
        placements: arr,
        claimedWords: preview.formed_words,
        claimedScore: preview.official_score,
        nextRackCommitment: drawPrep.newRackCommitment,
      });
      clientLogger.info('move accepted', { tx: result.txHash });

      // Step 4: finalize — persist new rack + updated bag to Supabase
      setStatus('Finalizing tile draw...');
      const finalRes = await fetch('/api/tiles/draw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, placedTileIds: placedIds, phase: 'finalize' }),
      });
      if (!finalRes.ok) {
        // Non-fatal: GenLayer accepted the move, but DB write failed.
        // The rack will re-sync on the next refresh from /api/racks.
        clientLogger.error('draw finalize failed — rack will re-sync on refresh', { gameId });
      }

      clearPlacements();
      setStatus('Move accepted. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function handlePass() {
    if (!walletClient) return;
    if (!rackCommitment) {
      setError('Rack commitment not loaded. Please wait for the page to fully load.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Pass does not draw new tiles; the rack commitment stays the same.
      await passTurn(walletClient, {
        gameId,
        nextRackCommitment: rackCommitment,
      });
      clearPlacements();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResign() {
    if (!walletClient) return;
    if (!confirm('Resign the game? This ends it.')) return;
    setBusy(true);
    try {
      await resignGame(walletClient, { gameId });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExchange(tileIdsToExchange: string[]) {
    if (!walletClient) return;
    setBusy(true);
    setError(null);
    setExchangeOpen(false);
    try {
      // Step 1: prepare — compute new rack + commitments without DB write
      setStatus('Preparing exchange...');
      const prepRes = await fetch('/api/tiles/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, tileIdsToExchange, phase: 'prepare' }),
      });
      if (!prepRes.ok) {
        const detail = (await prepRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`exchange_prepare_failed:${detail.error ?? prepRes.status}`);
      }
      const prep = (await prepRes.json()) as {
        exchangeCommitment: string;
        newRackCommitment: string;
      };

      // Step 2: record exchange on GenLayer
      setStatus('Submitting exchange to GenLayer...');
      await recordExchange(walletClient, {
        gameId,
        exchangeCommitment: prep.exchangeCommitment,
        nextRackCommitment: prep.newRackCommitment,
      });

      // Step 3: finalize — persist new rack + bag
      setStatus('Finalizing exchange...');
      const finalRes = await fetch('/api/tiles/exchange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ genlayerGameId: gameId, tileIdsToExchange, phase: 'finalize' }),
      });
      if (!finalRes.ok) {
        clientLogger.error('exchange finalize failed — rack will re-sync on refresh', { gameId });
      }

      clearPlacements();
      setStatus('Exchange complete. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function handleChallenge(reason: string) {
    if (!walletClient || !game?.last_move) return;
    setBusy(true);
    setError(null);
    setChallengeOpen(false);
    try {
      setStatus('Submitting challenge to GenLayer...');
      await challengeMove(walletClient, {
        gameId,
        moveNumber: game.last_move.moveNumber,
        reason,
      });
      setStatus('Challenge submitted. Waiting for resolution...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function handleResolveChallenge() {
    if (!walletClient || !game?.pending_challenge) return;
    setBusy(true);
    setError(null);
    setChallengeOpen(false);
    try {
      setStatus('Resolving challenge via GenLayer LLM...');
      await resolveChallenge(walletClient, {
        gameId,
        challengeId: game.pending_challenge.challenge_id,
      });
      setStatus('Challenge resolved. Refreshing...');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-10">Loading game…</main>
        <Footer />
      </>
    );
  }
  if (!game) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-2xl font-bold text-danger">Game not found on GenLayer.</h1>
          <p className="mt-2 text-sm text-text-muted">
            It may not have been mined yet, or the address may be wrong.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => router.push('/lobby')}>
            Back to lobby
          </Button>
        </main>
        <Footer />
      </>
    );
  }

  const playersWithScore = game.players.map((p, i) => ({
    walletAddress: p,
    score: game.scores[p] ?? 0,
    seatIndex: i,
  }));
  const currentTurnWallet = game.status === 'active' ? game.players[game.current_turn_index] ?? null : null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-sm text-text-muted">{game.game_id}</h1>
            <p className="text-xl font-bold text-text-dark">
              {game.status.toUpperCase()}{' '}
              <span className="text-sm font-normal text-text-muted">
                — {game.word_mode}
                {game.theme !== 'none' ? ` / ${game.theme}` : ''}
              </span>
            </p>
          </div>
          {game.status === 'completed' && game.winner && (
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-gold/10 px-4 py-1 text-sm font-semibold text-accent-gold">
              <Trophy size={16} /> Winner {game.winner.slice(0, 6)}…{game.winner.slice(-4)}
            </span>
          )}
        </div>

        {game.status === 'waiting' && (
          <SetupPanel
            game={game}
            walletAddress={walletAddress}
            isConnected={isConnected}
            busy={busy}
            status={status}
            error={error}
            gameId={gameId}
            onDealAndStart={handleDealAndStart}
            onJoin={handleJoin}
            onSignIn={signIn}
          />
        )}

        {game.status !== 'waiting' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <ScrabbleBoard
                board={game.board}
                preview={placements}
                onSquareClick={handleSquareClick}
              />
              <TileRack
                tiles={rack}
                selectedTileId={selectedTileId}
                placedTileIds={placedTileIds}
                onSelect={selectTile}
              />
              {myTurn && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleSubmitMove} disabled={busy || Object.keys(placements).length === 0}>
                    <Send size={16} /> Submit move
                  </Button>
                  <Button variant="secondary" onClick={clearPlacements} disabled={busy || Object.keys(placements).length === 0}>
                    Clear
                  </Button>
                  <Button variant="secondary" onClick={handlePass} disabled={busy}>
                    <SkipForward size={16} /> Pass
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setExchangeOpen(true)}
                    disabled={busy || Object.keys(placements).length > 0}
                    title={Object.keys(placements).length > 0 ? 'Clear board placements before exchanging' : 'Exchange tiles'}
                  >
                    <ArrowLeftRight size={16} /> Exchange
                  </Button>
                  <Button variant="danger" onClick={handleResign} disabled={busy}>
                    <Flag size={16} /> Resign
                  </Button>
                </div>
              )}
              {/* Challenge button: visible to opponents when there's a challengeable last move */}
              {game.status === 'active' && !myTurn && game.last_move && game.last_move.moveType === 'play_word' && !game.pending_challenge && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setChallengeOpen(true)}
                    disabled={busy}
                  >
                    <Gavel size={14} /> Challenge last move
                  </Button>
                </div>
              )}
              {/* Pending challenge banner — visible to everyone */}
              {game.pending_challenge && (
                <div className="flex items-center justify-between rounded-lg border border-accent-gold/40 bg-accent-gold/5 px-3 py-2">
                  <p className="text-xs text-accent-gold font-semibold flex items-center gap-1">
                    <AlertTriangle size={13} /> Challenge pending on move #{game.pending_challenge.move_number}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setChallengeOpen(true)}
                    disabled={busy}
                  >
                    <Gavel size={13} /> Resolve
                  </Button>
                </div>
              )}
              {status && <p className="text-xs text-text-muted">{status}</p>}
              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
            </div>

            <aside className="space-y-4">
              <ScorePanel
                players={playersWithScore}
                currentTurnWallet={currentTurnWallet}
                winnerWallet={game.winner}
              />
              <GenLayerProofPanel game={game} />
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-text-muted">Move history</h3>
                <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {game.move_history.slice().reverse().map((m) => (
                    <li key={m.moveNumber} className="text-xs">
                      <span className="font-mono text-text-muted">#{m.moveNumber}</span>{' '}
                      <span className="text-text-dark">{m.moveType}</span>{' '}
                      {m.formedWords && m.formedWords.length > 0 && (
                        <span className="font-semibold">{m.formedWords.join(', ')}</span>
                      )}{' '}
                      {typeof m.officialScore === 'number' && (
                        <span className="text-accent-gold">+{m.officialScore}</span>
                      )}
                    </li>
                  ))}
                  {game.move_history.length === 0 && (
                    <li className="text-xs text-text-muted">No moves yet.</li>
                  )}
                </ul>
              </div>
              <ChatPanel
                genlayerGameId={gameId}
                walletAddress={walletAddress}
              />
            </aside>
          </div>
        )}
      </main>
      <Footer />
      <WinnerModal
        isOpen={game?.status === 'completed' && !winnerDismissed}
        winner={game?.winner ?? null}
        players={game ? game.players.map((p, i) => ({ walletAddress: p, score: game.scores[p] ?? 0, seatIndex: i })) : []}
        endReason={game?.end_reason ?? null}
        walletAddress={walletAddress}
        onClose={() => setWinnerDismissed(true)}
        onBackToLobby={() => router.push('/lobby')}
      />
      <ChallengeModal
        isOpen={challengeOpen}
        lastMove={game?.last_move ?? null}
        pendingChallenge={game?.pending_challenge ?? null}
        walletAddress={walletAddress}
        busy={busy}
        onClose={() => setChallengeOpen(false)}
        onChallenge={handleChallenge}
        onResolve={handleResolveChallenge}
      />
      <ExchangeTilesModal
        isOpen={exchangeOpen}
        rack={rack}
        placedTileIds={placedTileIds}
        tileBagRemaining={tileBagRemaining}
        busy={busy}
        onClose={() => setExchangeOpen(false)}
        onConfirm={handleExchange}
      />
    </>
  );
}

function SetupPanel(props: {
  game: OnChainGame;
  walletAddress: string | null;
  isConnected: boolean;
  busy: boolean;
  status: string | null;
  error: string | null;
  gameId: string;
  onDealAndStart: () => void;
  onJoin: () => void;
  onSignIn: () => Promise<boolean>;
}) {
  const isCreator =
    props.walletAddress && props.walletAddress === props.game.creator.toLowerCase();
  const isAlreadyJoined =
    !!props.walletAddress &&
    props.game.players.map((p) => p.toLowerCase()).includes(props.walletAddress);
  const isFull = props.game.players.length >= props.game.max_players;
  const canStart = props.game.players.length >= 2;
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}/game/${props.gameId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-bold text-text-dark flex items-center gap-2">
        <Hammer size={18} className="text-primary" /> Setup
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {props.game.players.length} / {props.game.max_players} players. Mode:{' '}
        <strong>
          {props.game.word_mode}
          {props.game.theme !== 'none' ? ` / ${props.game.theme}` : ''}
        </strong>
        . Validation goes through{' '}
        {isValidModeTheme(props.game.word_mode, props.game.theme) ? 'GenLayer' : 'INVALID'}.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {props.game.players.map((p, i) => (
          <li key={p} className="font-mono text-xs text-text-dark">
            seat {i}: {p.slice(0, 6)}…{p.slice(-4)}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!props.isConnected && (
          <p className="text-sm text-text-muted">Connect a wallet to participate.</p>
        )}
        {props.isConnected && !props.walletAddress && (
          <Button onClick={props.onSignIn}>Sign in with wallet</Button>
        )}
        {isCreator && (
          <>
            <Button onClick={props.onDealAndStart} disabled={props.busy || !canStart}>
              {canStart ? 'Deal tiles & start' : 'Waiting for one more player'}
            </Button>
            <Button variant="ghost" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy invite link'}
            </Button>
          </>
        )}
        {!isCreator && props.walletAddress && !isAlreadyJoined && !isFull && (
          <Button onClick={props.onJoin} disabled={props.busy}>
            Join game
          </Button>
        )}
        {!isCreator && props.walletAddress && !isAlreadyJoined && isFull && (
          <p className="text-sm text-text-muted">Game is full.</p>
        )}
        {!isCreator && props.walletAddress && isAlreadyJoined && (
          <p className="text-sm text-text-muted">Waiting for creator to start the game.</p>
        )}
      </div>
      {props.status && <p className="mt-3 text-xs text-text-muted">{props.status}</p>}
      {props.error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {props.error}
        </p>
      )}
    </div>
  );
}
