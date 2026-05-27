import { NextResponse } from 'next/server';
import { clientEnv } from '@/lib/env/client';
import { serverEnv } from '@/lib/env';
import { GENLAYER_RPC_PROXY_PATH } from '@/lib/genlayer/rpc-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_GENLAYER_RPC_URL = 'https://studio.genlayer.com/api';

function getLegacyPublicRpcUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL?.trim();
  if (!value) return undefined;

  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_GENLAYER_RPC_URL must be an absolute http(s) URL.');
  }

  return url.toString();
}

function resolveUpstreamRpcUrl(): string {
  const upstream =
    serverEnv.GENLAYER_RPC_URL ??
    getLegacyPublicRpcUrl() ??
    DEFAULT_GENLAYER_RPC_URL;

  const appUrl = new URL(clientEnv.NEXT_PUBLIC_APP_URL);
  const proxyUrl = new URL(GENLAYER_RPC_PROXY_PATH, appUrl);
  if (upstream === GENLAYER_RPC_PROXY_PATH || upstream === proxyUrl.toString()) {
    throw new Error('GENLAYER_RPC_URL must point to an upstream RPC endpoint, not the app proxy.');
  }

  return upstream;
}

function getJsonRpcId(payload: unknown): string | number | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' || id === null ? id : null;
}

function jsonRpcError(
  id: string | number | null,
  status: number,
  code: number,
  message: string,
) {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

export async function POST(req: Request) {
  let rawBody = '';
  let payload: unknown;

  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonRpcError(null, 400, -32700, 'Invalid JSON-RPC payload.');
  }

  const id = getJsonRpcId(payload);

  try {
    const upstreamRes = await fetch(resolveUpstreamRpcUrl(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: rawBody,
      cache: 'no-store',
    });

    const responseBody = await upstreamRes.text();
    return new NextResponse(responseBody, {
      status: upstreamRes.status,
      headers: {
        'cache-control': 'no-store',
        'content-type': upstreamRes.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    return jsonRpcError(
      id,
      502,
      -32000,
      `GenLayer RPC upstream unavailable: ${(error as Error).message}`,
    );
  }
}
