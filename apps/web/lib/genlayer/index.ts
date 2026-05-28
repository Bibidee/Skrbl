/**
 * Public entry for the GenLayer contract layer.
 *
 * Typical usage from a client component:
 *
 *   import { useWallet } from '@/components/providers/EmbeddedWalletProvider';
 *   import { createGame } from '@/lib/genlayer';
 *
 *   const { getAccount } = useWallet();
 *   const account = getAccount();
 *   if (!account) return; // wallet locked — prompt unlock
 *   const { txHash, result } = await createGame(account, {
 *     gameId, wordMode: 'classic', theme: 'none', maxPlayers: 2, rackCommitment,
 *   });
 */
export * from './contract';
export * from './types';
export { getContractAddress, getReadClient, getWriteClient } from './client';
export { studioNet } from './chain';
