// Supabase Edge Function: notify-turn
// Called when the current turn changes. Logs the event and provides a hook
// for push notifications, email, or any other notification channel.
// Extend the `sendNotification` function below for your notification provider.
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
