// Supabase Edge Function: draw-tiles
// Two-phase tile draw (prepare/finalize) — mirrors /api/tiles/draw.
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
