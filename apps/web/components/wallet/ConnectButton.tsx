'use client';

import { ConnectButton as RKConnectButton } from '@rainbow-me/rainbowkit';

/**
 * Thin wrapper around RainbowKit's ConnectButton so feature code never imports the
 * vendor component directly. Lets us swap themes / sizing in one place.
 */
export function ConnectButton() {
  return (
    <RKConnectButton
      accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
      chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }}
      showBalance={{ smallScreen: false, largeScreen: true }}
    />
  );
}
