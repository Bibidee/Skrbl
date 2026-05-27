/**
 * WordCourt colour tokens (PDF section 13). Consumed by Tailwind theme config and
 * any inline styling. Keep these in sync with apps/web/tailwind config.
 */

export const PALETTE = {
  background: '#F8F7FF',
  surface: '#FFFFFF',
  surfaceSoft: '#F3F0FF',
  primary: '#6D28D9',
  primaryDark: '#4C1D95',
  accentGold: '#F59E0B',
  accentGreen: '#22C55E',
  textDark: '#1F1F1F',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#EF4444',
  success: '#16A34A',
} as const;

export const BOARD_COLORS = {
  base: '#F5E7C8',
  border: '#7C5C2E',
  normal: '#F8E8C8',
  doubleLetter: '#93C5FD',
  tripleLetter: '#2563EB',
  doubleWord: '#FCA5A5',
  tripleWord: '#DC2626',
  centreStar: '#F59E0B',
} as const;

export const TILE_COLORS = {
  background: '#FDECC8',
  border: '#C0842D',
  text: '#1F1F1F',
  scoreText: '#6B4E16',
  blank: '#FFF7E6',
  selectedGlow: '#6D28D9',
} as const;

export const PLAYER_COLORS = ['#6D28D9', '#2563EB', '#16A34A', '#F59E0B'] as const;
