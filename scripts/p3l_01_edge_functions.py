"""
Creates all 6 Supabase Edge Functions (Deno TypeScript).

Each function is self-contained: uses CDN imports for Supabase JS and
the Web Crypto API (native in Deno) for commitment hashing.

Functions:
  deal-tiles        – deals initial tiles for a game room
  draw-tiles        – draws replacement tiles after a move
  exchange-tiles    – exchanges tiles with the bag
  sync-game         – syncs GenLayer game state to Supabase
  update-leaderboard – upserts player stats after game completes
  notify-turn       – logs turn change (hook for push/email in production)
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FUNCS = ROOT / "supabase" / "functions"

# Shared CORS headers snippet used across all functions
CORS_HEADER = """\
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cors(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
"""

# -------------------------------------------------------------------------
# sync-game/index.ts
# -------------------------------------------------------------------------
SYNC = (FUNCS / "sync-game" / "index.ts")
SYNC.parent.mkdir(parents=True, exist_ok=True)

SYNC.write_text("""\
// Supabase Edge Function: sync-game
// Syncs the authoritative GenLayer game state into Supabase tables.
// Call via POST { genlayerGameId: string } — can be triggered by a client
// after any state-changing transaction, or by a Supabase Database Webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + """
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const glRpc = Deno.env.get('NEXT_PUBLIC_GENLAYER_RPC_URL') ?? 'https://studio.genlayer.com/api';
  const contractAddr = Deno.env.get('NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS');

  const supabase = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({})) as { genlayerGameId?: string };
  if (!body.genlayerGameId) return cors(400, { error: 'missing genlayerGameId' });

  const { genlayerGameId } = body;

  // Fetch game state from GenLayer RPC
  const rpcRes = await fetch(glRpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: contractAddr, data: `get_game:${genlayerGameId}` }],
      id: 1,
    }),
  }).catch(() => null);

  if (!rpcRes?.ok) {
    // Soft fail — GenLayer RPC may not be reachable from edge. Mark as best-effort.
    return cors(202, { ok: false, reason: 'genlayer_rpc_unreachable' });
  }

  const rpcData = await rpcRes.json() as { result?: string };
  if (!rpcData.result) return cors(202, { ok: false, reason: 'no_result' });

  let game: Record<string, unknown>;
  try {
    game = JSON.parse(rpcData.result);
  } catch {
    return cors(202, { ok: false, reason: 'parse_error' });
  }

  // Upsert games row
  const { data: gameRow, error: gameErr } = await supabase
    .from('games')
    .upsert(
      {
        genlayer_game_id: genlayerGameId,
        status: game['status'],
        winner_wallet: game['winner'] ?? null,
        end_reason: game['end_reason'] ?? null,
        current_turn_wallet:
          game['status'] === 'active'
            ? (game['players'] as string[])[game['current_turn_index'] as number] ?? null
            : null,
      },
      { onConflict: 'genlayer_game_id' },
    )
    .select('id')
    .single();

  if (gameErr || !gameRow) {
    return cors(500, { error: 'game_upsert_failed', detail: gameErr?.message });
  }

  return cors(200, { ok: true, status: game['status'] });
});
""", encoding="utf-8")
print(f"[OK] sync-game")

# -------------------------------------------------------------------------
# update-leaderboard/index.ts
# -------------------------------------------------------------------------
LB = FUNCS / "update-leaderboard" / "index.ts"
LB.parent.mkdir(parents=True, exist_ok=True)

LB.write_text("""\
// Supabase Edge Function: update-leaderboard
// Upserts player stats when a game ends.
// Triggered via POST { genlayerGameId, players, scores, winner }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + """
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({})) as {
    players?: string[];
    scores?: Record<string, number>;
    winner?: string | null;
  };

  if (!body.players || !body.scores) {
    return cors(400, { error: 'missing players or scores' });
  }

  const results: Array<{ wallet: string; ok: boolean }> = [];

  for (const wallet of body.players) {
    const score = body.scores[wallet] ?? 0;
    const isWinner = body.winner && wallet.toLowerCase() === body.winner.toLowerCase();

    const { data: existing } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle();

    const prev = existing ?? {
      games_played: 0, wins: 0, losses: 0, total_score: 0,
      highest_word_score: 0, average_score: 0, rank_points: 0,
    };

    const gamesPlayed = (prev.games_played as number) + 1;
    const wins = (prev.wins as number) + (isWinner ? 1 : 0);
    const losses = (prev.losses as number) + (isWinner ? 0 : 1);
    const totalScore = (prev.total_score as number) + score;
    const rankPoints = Math.max(0, (prev.rank_points as number) + (isWinner ? 25 : -10));

    const { error } = await supabase.from('leaderboard').upsert(
      {
        wallet_address: wallet.toLowerCase(),
        games_played: gamesPlayed,
        wins,
        losses,
        total_score: totalScore,
        average_score: Math.round(totalScore / gamesPlayed),
        highest_word_score: Math.max(prev.highest_word_score as number, score),
        rank_points: rankPoints,
      },
      { onConflict: 'wallet_address' },
    );
    results.push({ wallet: wallet.slice(0, 8), ok: !error });
  }

  return cors(200, { ok: true, results });
});
""", encoding="utf-8")
print(f"[OK] update-leaderboard")

# -------------------------------------------------------------------------
# notify-turn/index.ts
# -------------------------------------------------------------------------
NOTIFY = FUNCS / "notify-turn" / "index.ts"
NOTIFY.parent.mkdir(parents=True, exist_ok=True)

NOTIFY.write_text("""\
// Supabase Edge Function: notify-turn
// Called when the current turn changes. Logs the event and provides a hook
// for push notifications, email, or any other notification channel.
// Extend the `sendNotification` function below for your notification provider.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + """
async function sendNotification(_wallet: string, _gameId: string): Promise<void> {
  // TODO: integrate with your push or email provider here.
  // Example providers: Resend (email), web-push, Expo push notifications.
  // For now this is a no-op that logs to the Supabase Edge Function logs.
  console.log(`[notify-turn] Turn changed for wallet ${_wallet} in game ${_gameId}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.json().catch(() => ({})) as {
    currentTurnWallet?: string;
    genlayerGameId?: string;
  };

  if (!body.currentTurnWallet || !body.genlayerGameId) {
    return cors(400, { error: 'missing currentTurnWallet or genlayerGameId' });
  }

  await sendNotification(body.currentTurnWallet, body.genlayerGameId);
  return cors(200, { ok: true });
});
""", encoding="utf-8")
print(f"[OK] notify-turn")

# -------------------------------------------------------------------------
# Helper: SHA-256 in Deno (Web Crypto API)
# -------------------------------------------------------------------------
HASH_HELPER = """\
async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashRackCommitment(
  secret: string, wallet: string,
  letters: string[], version: number,
): Promise<string> {
  const h = await sha256Hex(`${secret}|rack|${wallet.toLowerCase()}|${letters.join(',')}|v${version}`);
  return `0x${h}`;
}

async function hashBagCommitment(secret: string, orderedBag: string[]): Promise<string> {
  const h = await sha256Hex(`${secret}|bag|${orderedBag.join(',')}`);
  return `0x${h}`;
}
"""

# -------------------------------------------------------------------------
# deal-tiles/index.ts
# -------------------------------------------------------------------------
DEAL = FUNCS / "deal-tiles" / "index.ts"
DEAL.parent.mkdir(parents=True, exist_ok=True)

DEAL.write_text("""\
// Supabase Edge Function: deal-tiles
// Deals initial tiles for a game room. Alternative to the Next.js
// /api/tiles/deal route — useful when called from other edge functions
// or Supabase Database Webhooks without going through Next.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + HASH_HELPER + """
// Fisher-Yates shuffle with mulberry32 PRNG
function mulberry32(seed: number) {
  let s = (seed >>> 0);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr: string[], seed: number): string[] {
  const rng = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Scrabble tile distribution (100 tiles)
const TILE_DISTRIBUTION: string[] = [
  ...Array(9).fill('A'), ...Array(2).fill('B'), ...Array(2).fill('C'),
  ...Array(4).fill('D'), ...Array(12).fill('E'), ...Array(2).fill('F'),
  ...Array(3).fill('G'), ...Array(2).fill('H'), ...Array(9).fill('I'),
  ...Array(1).fill('J'), ...Array(1).fill('K'), ...Array(4).fill('L'),
  ...Array(2).fill('M'), ...Array(6).fill('N'), ...Array(8).fill('O'),
  ...Array(2).fill('P'), ...Array(1).fill('Q'), ...Array(6).fill('R'),
  ...Array(4).fill('S'), ...Array(6).fill('T'), ...Array(4).fill('U'),
  ...Array(2).fill('V'), ...Array(2).fill('W'), ...Array(1).fill('X'),
  ...Array(2).fill('Y'), ...Array(1).fill('Z'), ...Array(2).fill('_'),
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const secret = Deno.env.get('TILE_COMMITMENT_SECRET') ?? '';

  const body = await req.json().catch(() => ({})) as {
    genlayerGameId?: string;
    roomCode?: string;
  };
  if (!body.genlayerGameId || !body.roomCode) {
    return cors(400, { error: 'missing genlayerGameId or roomCode' });
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('*, room_players(wallet_address, seat_index)')
    .eq('room_code', body.roomCode)
    .maybeSingle();
  if (!room) return cors(404, { error: 'room_not_found' });

  const seats = ((room.room_players ?? []) as Array<{ wallet_address: string; seat_index: number }>)
    .sort((a, b) => a.seat_index - b.seat_index);
  if (seats.length < 2) return cors(400, { error: 'need_two_players' });

  const seed = Math.floor(Math.random() * 2 ** 31);
  const shuffled = shuffle(TILE_DISTRIBUTION, seed);
  const bagCommitment = await hashBagCommitment(secret, shuffled);

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .upsert(
      { genlayer_game_id: body.genlayerGameId, room_id: room.id, status: 'dealing',
        word_mode: room.word_mode, theme: room.theme, creator_wallet: room.creator_wallet,
        tile_bag_remaining: 100 },
      { onConflict: 'genlayer_game_id' },
    )
    .select('id')
    .single();
  if (gameErr || !game) return cors(500, { error: 'game_upsert_failed' });

  const rackCommitments: Array<{ walletAddress: string; rackCommitment: string }> = [];
  let cursor = 0;
  for (const seat of seats) {
    const tiles = shuffled.slice(cursor, cursor + 7);
    cursor += 7;
    const rc = await hashRackCommitment(secret, seat.wallet_address, tiles, 1);
    rackCommitments.push({ walletAddress: seat.wallet_address, rackCommitment: rc });
    await supabase.from('player_racks').upsert(
      { game_id: game.id, wallet_address: seat.wallet_address.toLowerCase(),
        tiles: tiles.map((l, i) => ({ id: `t_${Date.now()}_${i}`, letter: l, points: 0, isBlank: l === '_' })),
        rack_commitment: rc, rack_version: 1 },
      { onConflict: 'game_id,wallet_address' },
    );
  }

  const remaining = shuffled.slice(cursor);
  await supabase.from('tile_bags').upsert(
    { game_id: game.id, remaining_tiles: remaining, used_tiles: [], exchanged_tiles: [],
      bag_commitment: bagCommitment, draw_count: seats.length * 7 },
    { onConflict: 'game_id' },
  );
  await supabase.from('games').update({ tile_bag_remaining: remaining.length }).eq('id', game.id);

  return cors(200, { bagCommitment, rackCommitments, remainingTiles: remaining.length });
});
""", encoding="utf-8")
print(f"[OK] deal-tiles")

# -------------------------------------------------------------------------
# draw-tiles/index.ts
# -------------------------------------------------------------------------
DRAW = FUNCS / "draw-tiles" / "index.ts"
DRAW.parent.mkdir(parents=True, exist_ok=True)

DRAW.write_text("""\
// Supabase Edge Function: draw-tiles
// Two-phase tile draw (prepare/finalize) — mirrors /api/tiles/draw.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + HASH_HELPER + """
const RACK_SIZE = 7;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const secret = Deno.env.get('TILE_COMMITMENT_SECRET') ?? '';

  const body = await req.json().catch(() => ({})) as {
    genlayerGameId?: string;
    walletAddress?: string;
    placedTileIds?: string[];
    phase?: 'prepare' | 'finalize';
  };
  if (!body.genlayerGameId || !body.walletAddress || !body.phase) {
    return cors(400, { error: 'missing required fields' });
  }

  const wallet = body.walletAddress.toLowerCase();
  const { data: game } = await supabase
    .from('games').select('id').eq('genlayer_game_id', body.genlayerGameId).maybeSingle();
  if (!game) return cors(404, { error: 'game_not_found' });

  const { data: rackRow } = await supabase
    .from('player_racks').select('tiles, rack_version')
    .eq('game_id', game.id).eq('wallet_address', wallet).maybeSingle();
  if (!rackRow) return cors(404, { error: 'rack_not_found' });

  const { data: bagRow } = await supabase
    .from('tile_bags').select('remaining_tiles, used_tiles, draw_count')
    .eq('game_id', game.id).maybeSingle();
  if (!bagRow) return cors(404, { error: 'bag_not_found' });

  const currentRack = rackRow.tiles as Array<{ id: string; letter: string; isBlank: boolean }>;
  const remaining = bagRow.remaining_tiles as string[];
  const placedIds = new Set(body.placedTileIds ?? []);
  const rackAfter = currentRack.filter((t) => !placedIds.has(t.id));
  const needCount = Math.min(RACK_SIZE - rackAfter.length, remaining.length);
  const drawn = remaining.slice(0, needCount).map((l, i) => ({
    id: `t_${Date.now()}_${i}`, letter: l, points: 0, isBlank: l === '_',
  }));
  const newRemaining = remaining.slice(needCount);
  const newRack = [...rackAfter, ...drawn];
  const newVersion = (rackRow.rack_version as number) + 1;
  const newRackCommitment = await hashRackCommitment(
    secret, wallet,
    newRack.map((t) => t.isBlank ? '_' : t.letter),
    newVersion,
  );

  if (body.phase === 'finalize') {
    await supabase.from('player_racks')
      .update({ tiles: newRack, rack_commitment: newRackCommitment, rack_version: newVersion })
      .eq('game_id', game.id).eq('wallet_address', wallet);
    await supabase.from('tile_bags')
      .update({
        remaining_tiles: newRemaining,
        used_tiles: [...(bagRow.used_tiles as string[]), ...drawn.map((t) => t.letter)],
        draw_count: (bagRow.draw_count as number) + drawn.length,
      })
      .eq('game_id', game.id);
    await supabase.from('games').update({ tile_bag_remaining: newRemaining.length }).eq('id', game.id);
  }

  return cors(200, { newRack, newRackCommitment, rackVersion: newVersion,
    drawnCount: drawn.length, tileBagRemaining: newRemaining.length });
});
""", encoding="utf-8")
print(f"[OK] draw-tiles")

# -------------------------------------------------------------------------
# exchange-tiles/index.ts
# -------------------------------------------------------------------------
EXCHANGE = FUNCS / "exchange-tiles" / "index.ts"
EXCHANGE.parent.mkdir(parents=True, exist_ok=True)

EXCHANGE.write_text("""\
// Supabase Edge Function: exchange-tiles
// Two-phase tile exchange (prepare/finalize) — mirrors /api/tiles/exchange.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

""" + CORS_HEADER + HASH_HELPER + """
const MIN_BAG = 7;

function mulberry32(seed: number) {
  let s = (seed >>> 0);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr: string[], seed: number): string[] {
  const rng = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function hashExchangeCommitment(
  secret: string, wallet: string, returned: string[], drawn: string[],
): Promise<string> {
  const h = await sha256Hex(
    `${secret}|exchange|${wallet.toLowerCase()}|out|${returned.join(',')}|in|${drawn.join(',')}`,
  );
  return `0x${h}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const secret = Deno.env.get('TILE_COMMITMENT_SECRET') ?? '';

  const body = await req.json().catch(() => ({})) as {
    genlayerGameId?: string;
    walletAddress?: string;
    tileIdsToExchange?: string[];
    phase?: 'prepare' | 'finalize';
  };
  if (!body.genlayerGameId || !body.walletAddress || !body.tileIdsToExchange || !body.phase) {
    return cors(400, { error: 'missing required fields' });
  }

  const wallet = body.walletAddress.toLowerCase();
  const { data: game } = await supabase
    .from('games').select('id').eq('genlayer_game_id', body.genlayerGameId).maybeSingle();
  if (!game) return cors(404, { error: 'game_not_found' });

  const { data: rackRow } = await supabase
    .from('player_racks').select('tiles, rack_version')
    .eq('game_id', game.id).eq('wallet_address', wallet).maybeSingle();
  if (!rackRow) return cors(404, { error: 'rack_not_found' });

  const { data: bagRow } = await supabase
    .from('tile_bags').select('remaining_tiles, used_tiles, exchanged_tiles, draw_count')
    .eq('game_id', game.id).maybeSingle();
  if (!bagRow) return cors(404, { error: 'bag_not_found' });

  const remaining = bagRow.remaining_tiles as string[];
  if (remaining.length < MIN_BAG) {
    return cors(409, { error: 'bag_too_small', bagRemaining: remaining.length });
  }

  const rack = rackRow.tiles as Array<{ id: string; letter: string; isBlank: boolean }>;
  const idsSet = new Set(body.tileIdsToExchange);
  const toReturn = rack.filter((t) => idsSet.has(t.id));
  if (toReturn.length === 0) return cors(400, { error: 'no_matching_tiles' });

  const kept = rack.filter((t) => !idsSet.has(t.id));
  const returnedLetters = toReturn.map((t) => t.isBlank ? '_' : t.letter);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const mixed = shuffle([...remaining, ...returnedLetters], seed);
  const drawnLetters = mixed.slice(0, toReturn.length);
  const newBag = mixed.slice(toReturn.length);
  const drawnTiles = drawnLetters.map((l, i) => ({
    id: `t_${Date.now()}_${i}`, letter: l, points: 0, isBlank: l === '_',
  }));
  const newRack = [...kept, ...drawnTiles];
  const newVersion = (rackRow.rack_version as number) + 1;

  const [exchangeCommitment, newRackCommitment] = await Promise.all([
    hashExchangeCommitment(secret, wallet, returnedLetters, drawnLetters),
    hashRackCommitment(secret, wallet, newRack.map((t) => t.isBlank ? '_' : t.letter), newVersion),
  ]);

  if (body.phase === 'finalize') {
    await supabase.from('player_racks')
      .update({ tiles: newRack, rack_commitment: newRackCommitment, rack_version: newVersion })
      .eq('game_id', game.id).eq('wallet_address', wallet);
    await supabase.from('tile_bags')
      .update({
        remaining_tiles: newBag,
        used_tiles: [...(bagRow.used_tiles as string[]), ...drawnLetters],
        exchanged_tiles: [...(bagRow.exchanged_tiles as string[]), ...returnedLetters],
        draw_count: (bagRow.draw_count as number) + drawnLetters.length,
      })
      .eq('game_id', game.id);
    await supabase.from('games').update({ tile_bag_remaining: newBag.length }).eq('id', game.id);
  }

  return cors(200, { newRack, exchangeCommitment, newRackCommitment,
    rackVersion: newVersion, drawnCount: drawnLetters.length, tileBagRemaining: newBag.length });
});
""", encoding="utf-8")
print(f"[OK] exchange-tiles")

print("[DONE] All 6 edge functions created.")
