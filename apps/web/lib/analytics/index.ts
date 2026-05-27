/**
 * Analytics facade. No-op until NEXT_PUBLIC_ANALYTICS_KEY is set. Provides a stable
 * call surface so feature code never references vendor SDKs directly.
 */

export type AnalyticsEvent =
  | { name: 'page_view'; path: string }
  | { name: 'wallet_connect'; chainId: number }
  | { name: 'room_create'; mode: string; maxPlayers: number }
  | { name: 'move_submit'; gameId: string; placements: number }
  | { name: 'move_challenge'; gameId: string }
  | { name: 'game_end'; gameId: string; winnerWallet: string };

export function track(_event: AnalyticsEvent): void {
  // Intentional no-op. Wire to a vendor when NEXT_PUBLIC_ANALYTICS_KEY is configured.
  // Implementation lands in a later phase once the vendor is chosen.
}
