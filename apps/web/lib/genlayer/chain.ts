/**
 * GenLayer StudioNet chain definition reused by the read client and any future
 * direct viem interactions. Pulled from env so the chain id / RPC stays in
 * one place.
 */
import { defineChain } from 'viem';
import { clientEnv } from '../env/client';

export const studioNet = defineChain({
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: 'GenLayer StudioNet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: [clientEnv.NEXT_PUBLIC_GENLAYER_RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: 'GenLayer Studio Explorer',
      url: clientEnv.NEXT_PUBLIC_GENLAYER_EXPLORER_URL,
    },
  },
  testnet: true,
});
