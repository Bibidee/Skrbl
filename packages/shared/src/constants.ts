/** Core gameplay constants (PDF sections 10, 16, 23). */
import type { DictionaryMode, GameMode } from './types';

export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const DEFAULT_TURN_SECONDS = 120;

/** Two consecutive full-round passes can end the MVP game (PDF section 10). */
export const MAX_CONSECUTIVE_PASSES_PER_ROUND = 2;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const SUPPORTED_PLAYER_COUNTS = [2, 3, 4] as const;

/** Dictionary modes enabled for the MVP (PDF section 23). */
export const MVP_DICTIONARY_MODES: readonly DictionaryMode[] = ['classic', 'crypto', 'genlayer'];

export const ALL_DICTIONARY_MODES: readonly DictionaryMode[] = [
  'classic',
  'crypto',
  'genlayer',
  'naija',
  'custom',
];

export const ALL_GAME_MODES: readonly GameMode[] = ['classic', 'blitz', 'crypto', 'naija', 'custom'];

export const DICTIONARY_MODE_LABELS: Readonly<Record<DictionaryMode, string>> = {
  classic: 'Classic',
  crypto: 'Crypto',
  genlayer: 'GenLayer',
  naija: 'Naija Slang',
  custom: 'Custom',
  themed: 'Themed',
};

/** Canonical labels for the deployed v0.3.0 contract's (word_mode, theme) pair. */
export const WORD_MODE_LABELS = {
  classic: 'Classic',
  themed: 'Themed',
  custom: 'Custom',
} as const;

export const THEME_LABELS = {
  none: 'None',
  crypto: 'Crypto',
  genlayer: 'GenLayer',
} as const;
