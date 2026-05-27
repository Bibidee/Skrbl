// Supabase Edge Function: sync-game
// Syncs the authoritative GenLayer game state into Supabase tables.
// Call via POST { genlayerGameId: string } — can be triggered by a client
// after any state-changing transaction, or by a Supabase Database Webhook.
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
