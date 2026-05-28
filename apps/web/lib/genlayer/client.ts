'use client';

/**
 * GenLayer client factory. Provides two flavours:
 *
 *  - `getReadClient()`  - no wallet required; used by view-only calls.
 *  - `getWriteClient(walletClient)`  - needs a connected wagmi WalletClient;
 *    used by every write call on the WordCourt contract.
 *
 * The contract address is loaded from NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS
 * via `assertConfigured()` so attempts to call into the contract before it's
 * wired produce a precise error instead of a silent failure.
 *
 * If `genlayer-js` exposes its own chain preset for StudioNet, prefer that;
 * we fall back to our own `studioNet` viem chain object for the read client.
 */
import { assertConfigured, clientEnv } from '../env/client';
import type { PrivateKeyAccount } from 'viem';
import { getBrowserGenLayerRpcUrl } from './rpc-url';

// genlayer-js types vary across versions; we keep the surface area narrow.
type GenLayerReadClient = {
  readContract: (args: {
    address: `0x${string}`;
    functionName: string;
    args?: readonly unknown[];
  }) => Promise<unknown>;
};

type GenLayerWriteClient = GenLayerReadClient & {
  writeContract: (args: {
    address: `0x${string}`;
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }) => Promise<`0x${string}`>;
  waitForTransactionReceipt: (args: {
    hash: `0x${string}`;
    status?: string;
    interval?: number;
    retries?: number;
  }) => Promise<{
    status: 'success' | 'reverted' | string;
    transactionHash: `0x${string}`;
    [k: string]: unknown;
  }>;
};

let cachedRead: GenLayerReadClient | null = null;

export function getContractAddress(): `0x${string}` {
  const addr = assertConfigured(
    'NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS',
    clientEnv.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
  );
  return addr as `0x${string}`;
}

export async function getReadClient(): Promise<GenLayerReadClient> {
  if (cachedRead) return cachedRead;
  const { createClient } = await import('genlayer-js');
  const { studioNet } = await import('./chain');
  cachedRead = createClient({
    chain: studioNet,
    endpoint: getBrowserGenLayerRpcUrl(),
  } as unknown as Parameters<typeof createClient>[0]) as unknown as GenLayerReadClient;
  return cachedRead;
}

export async function getWriteClient(account: PrivateKeyAccount): Promise<GenLayerWriteClient> {
  if (!account?.address) {
    throw new Error('GENLAYER_WALLET_ACCOUNT_MISSING');
  }
  const { createClient } = await import('genlayer-js');
  const { studioNet } = await import('./chain');
  // Embedded wallet: pass the local viem account so genlayer-js signs in-process
  // (no external provider / wallet extension).
  const client = createClient({
    chain: studioNet,
    endpoint: getBrowserGenLayerRpcUrl(),
    account,
  } as unknown as Parameters<typeof createClient>[0]) as unknown as GenLayerWriteClient;
  return client;
}
