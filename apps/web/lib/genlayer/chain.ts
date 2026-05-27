/**
 * GenLayer StudioNet chain definition for genlayer-js. Start from the SDK's
 * official 1.1.7 chain so write calls keep the consensus contract metadata.
 */
import { studionet } from 'genlayer-js/chains';
import { clientEnv } from '../env/client';
import { getBrowserGenLayerRpcUrl } from './rpc-url';

const rpcUrl = getBrowserGenLayerRpcUrl();

export const studioNet = {
  ...studionet,
  id: clientEnv.NEXT_PUBLIC_CHAIN_ID,
  name: 'GenLayer StudioNet',
  rpcUrls: {
    ...studionet.rpcUrls,
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'GenLayer Studio Explorer',
      url: clientEnv.NEXT_PUBLIC_GENLAYER_EXPLORER_URL,
    },
  },
} satisfies typeof studionet;
