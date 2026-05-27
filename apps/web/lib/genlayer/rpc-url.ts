import { clientEnv } from '../env/client';

export const GENLAYER_RPC_PROXY_PATH = '/api/genlayer/rpc';

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getBrowserGenLayerRpcUrl(): string {
  const configured = clientEnv.NEXT_PUBLIC_GENLAYER_RPC_PROXY_URL ?? GENLAYER_RPC_PROXY_PATH;
  if (isAbsoluteHttpUrl(configured)) return configured;

  const base =
    typeof window === 'undefined' ? clientEnv.NEXT_PUBLIC_APP_URL : window.location.origin;

  return new URL(configured, base).toString();
}
