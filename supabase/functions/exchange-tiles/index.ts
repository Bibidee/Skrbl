// Supabase Edge Function: exchange-tiles
// Two-phase tile exchange (prepare/finalize) — mirrors /api/tiles/exchange.
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
