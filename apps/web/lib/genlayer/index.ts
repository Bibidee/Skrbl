/**
 * Public entry for the GenLayer contract layer.
 *
 * Typical usage from a client component:
 *
 *   import { useWalletClient } from 'wagmi';
 *   import { createGame } from '@/lib/genlayer';
 *
 *   const { data: walletClient } = useWalletClient();
 *   if (!walletClient) return;
 *   const { txHash, result } = await createGame(walletClient, {
 *     gameId, wordMode: 'classic', theme: 'none', maxPlayers: 2, rackCommitment,
 *   });
 */
export * from './contract';
export * from './types';
export { getContractAddress, getReadClient, getWriteClient } from './client';
export { studioNet } from './chain';
