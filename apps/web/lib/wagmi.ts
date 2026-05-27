/**
 * wagmi + RainbowKit configuration. Registers the GenLayer StudioNet as a custom
 * viem chain so wallets can sign in the right network context for contract calls.
 *
 * Uses only the browser-injected connector (MetaMask / any EIP-1193 wallet).
 * RainbowKit UI is preserved — ConnectButton still shows its modal.
 */
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { mainnet, sepolia } from 'wagmi/chains';
import { clientEnv } from './env/client';

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

export const wagmiConfig = createConfig({
  chains: [studioNet, mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [studioNet.id]: http(clientEnv.NEXT_PUBLIC_GENLAYER_RPC_URL),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
