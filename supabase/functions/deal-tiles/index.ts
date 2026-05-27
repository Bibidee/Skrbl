// Supabase Edge Function: deal-tiles
// Deals initial tiles for a game room. Alternative to the Next.js
// /api/tiles/deal route — useful when called from other edge functions
// or Supabase Database Webhooks without going through Next.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
