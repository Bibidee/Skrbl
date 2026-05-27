"""
Removes WalletConnect dependency — switches wagmi config to injected()
connector only while keeping RainbowKit UI intact.

Changes:
  apps/web/lib/wagmi.ts          — createConfig + injected() instead of getDefaultConfig
  apps/web/lib/env/client.ts     — remove NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# 1. wagmi.ts — swap getDefaultConfig for createConfig + injected()
# ---------------------------------------------------------------------------
WAGMI = ROOT / "apps" / "web" / "lib" / "wagmi.ts"
text = WAGMI.read_text(encoding="utf-8")

OLD_WAGMI = """\
/**
 * wagmi + RainbowKit configuration. Registers the GenLayer StudioNet as a custom
 * viem chain so wallets can sign in the right network context for contract calls.
 */
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
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

export const wagmiConfig = getDefaultConfig({
  appName: clientEnv.NEXT_PUBLIC_APP_NAME,
  projectId: clientEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [studioNet, mainnet, sepolia],
  ssr: true,
});"""

NEW_WAGMI = """\
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
});"""

if OLD_WAGMI not in text:
    print("[FAIL] wagmi.ts — patch target not found"); sys.exit(1)
WAGMI.write_text(text.replace(OLD_WAGMI, NEW_WAGMI, 1), encoding="utf-8")
print("[OK] apps/web/lib/wagmi.ts — switched to createConfig + injected()")

# ---------------------------------------------------------------------------
# 2. env/client.ts — remove NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# ---------------------------------------------------------------------------
ENV = ROOT / "apps" / "web" / "lib" / "env" / "client.ts"
text = ENV.read_text(encoding="utf-8")

# Remove from schema object
OLD_SCHEMA = """\
  // RainbowKit/WalletConnect requires a project id at runtime; in dev we fall back
  // to a placeholder so the app boots without registration.
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1).default('wordcourt-dev-placeholder'),
"""
if OLD_SCHEMA not in text:
    print("[FAIL] env/client.ts schema patch not found"); sys.exit(1)
text = text.replace(OLD_SCHEMA, "", 1)

# Remove from safeParse object
OLD_PARSE = """\
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
"""
if OLD_PARSE not in text:
    print("[FAIL] env/client.ts parse patch not found"); sys.exit(1)
text = text.replace(OLD_PARSE, "", 1)

ENV.write_text(text, encoding="utf-8")
print("[OK] apps/web/lib/env/client.ts — removed NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID")
