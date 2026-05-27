"""
Adds two missing pieces to the game page:
  1. A "Join game" button for non-creator visitors who aren't yet in players[]
  2. A "Copy invite link" button for the creator on the setup panel

Without (1), a joiner who clicks the shared URL just sees "Waiting for creator
to start" but is never actually added to the on-chain players list, so the
creator's screen says "Waiting for one more player" forever.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
original = text

# -----------------------------------------------------------------------------
# 1. Import joinGame
# -----------------------------------------------------------------------------
OLD1 = """import {
  challengeMove,
  getGame,
  passTurn,
  recordExchange,
  resignGame,
  resolveChallenge,
  startGame,
  submitMove,
  commitTileBag,
  commitRack,
  type OnChainGame,
} from '@/lib/genlayer';"""
NEW1 = """import {
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
} from '@/lib/genlayer';"""
if OLD1 not in text:
    print("[FAIL] import patch target not found"); sys.exit(1)
text = text.replace(OLD1, NEW1, 1)

# -----------------------------------------------------------------------------
# 2. Add handleJoin function — find the handleDealAndStart and inject before it
# -----------------------------------------------------------------------------
ANCHOR = "  async function handleDealAndStart"
if ANCHOR not in text:
    print("[FAIL] handleDealAndStart anchor not found"); sys.exit(1)

HANDLE_JOIN = """  const handleJoin = useCallback(async () => {
    if (!walletClient || !walletAddress || !game) return;
    setError(null);
    setBusy(true);
    setStatus('Joining game on GenLayer...');
    try {
      // Placeholder commitment — replaced by /api/tiles/deal once the bag is dealt.
      const rackCommitment = `pending_${gameId}_${walletAddress.slice(2, 10)}`;
      await joinGame(walletClient, { gameId, rackCommitment });
      setStatus('Joined! Waiting for the creator to start the game...');
      await refresh();
    } catch (e) {
      clientLogger.error('join game failed', { msg: (e as Error).message });
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [walletClient, walletAddress, game, gameId, refresh]);

"""
text = text.replace(ANCHOR, HANDLE_JOIN + ANCHOR, 1)

# -----------------------------------------------------------------------------
# 3. Pass handleJoin + isAlreadyJoined to SetupPanel
# -----------------------------------------------------------------------------
OLD3 = """<SetupPanel
            game={game}
            walletAddress={walletAddress}
            isConnected={isConnected}
            busy={busy}
            status={status}
            error={error}
            onDealAndStart={handleDealAndStart}
            onSignIn={signIn}
          />"""
NEW3 = """<SetupPanel
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
          />"""
if OLD3 not in text:
    print("[FAIL] SetupPanel props patch target not found"); sys.exit(1)
text = text.replace(OLD3, NEW3, 1)

# -----------------------------------------------------------------------------
# 4. Update SetupPanel signature + body
# -----------------------------------------------------------------------------
OLD4 = """function SetupPanel(props: {
  game: OnChainGame;
  walletAddress: string | null;
  isConnected: boolean;
  busy: boolean;
  status: string | null;
  error: string | null;
  onDealAndStart: () => void;
  onSignIn: () => Promise<boolean>;
}) {
  const isCreator =
    props.walletAddress && props.walletAddress === props.game.creator.toLowerCase();
  const canStart = props.game.players.length >= 2;"""
NEW4 = """function SetupPanel(props: {
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
  };"""
if OLD4 not in text:
    print("[FAIL] SetupPanel signature patch target not found"); sys.exit(1)
text = text.replace(OLD4, NEW4, 1)

# -----------------------------------------------------------------------------
# 5. Update SetupPanel button section — add Copy invite (creator) + Join (non-creator)
# -----------------------------------------------------------------------------
OLD5 = """        {isCreator && (
          <Button onClick={props.onDealAndStart} disabled={props.busy || !canStart}>
            {canStart ? 'Deal tiles & start' : 'Waiting for one more player'}
          </Button>
        )}
        {!isCreator && props.walletAddress && (
          <p className="text-sm text-text-muted">Waiting for creator to start the game.</p>
        )}"""
NEW5 = """        {isCreator && (
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
        )}"""
if OLD5 not in text:
    print("[FAIL] SetupPanel button section patch target not found"); sys.exit(1)
text = text.replace(OLD5, NEW5, 1)

# -----------------------------------------------------------------------------
# 6. Add React import for useState in SetupPanel (it uses React.useState now)
# -----------------------------------------------------------------------------
OLD6 = "import { use, useCallback, useEffect, useMemo, useState } from 'react';"
NEW6 = "import * as React from 'react';\nimport { use, useCallback, useEffect, useMemo, useState } from 'react';"
if OLD6 not in text:
    print("[FAIL] react import patch target not found"); sys.exit(1)
text = text.replace(OLD6, NEW6, 1)

TARGET.write_text(text, encoding="utf-8")
delta = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] game page patched (+{delta} lines)")
