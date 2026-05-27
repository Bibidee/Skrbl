'use client';

import { Star } from 'lucide-react';
import { getPremiumSquare, isCentre } from '@wordcourt/shared';
import type { BoardTile, Placement, PremiumSquare } from '@wordcourt/shared';
import { cn } from '@/lib/utils/cn';
import { Tile } from './Tile';

type Props = {
  row: number;
  col: number;
  tile?: BoardTile;
  preview?: Placement;
  onClick: () => void;
  highlighted?: boolean;
};

const PREMIUM_BG: Record<PremiumSquare, string> = {
  normal: 'bg-square-normal',
  double_letter: 'bg-square-dl',
  triple_letter: 'bg-square-tl text-white',
  double_word: 'bg-square-dw',
  triple_word: 'bg-square-tw text-white',
  centre: 'bg-accent-gold',
};

const PREMIUM_LABEL: Record<PremiumSquare, string> = {
  normal: '',
  double_letter: 'DL',
  triple_letter: 'TL',
  double_word: 'DW',
  triple_word: 'TW',
  centre: '',
};

export function BoardSquare({ row, col, tile, preview, onClick, highlighted }: Props) {
  const premium = getPremiumSquare(row, col);
  const hasTile = Boolean(tile);
  const hasPreview = Boolean(preview);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Board square row ${row} column ${col}`}
      className={cn(
        'relative flex aspect-square items-center justify-center text-[10px] font-semibold',
        'border border-board-border/30 transition-all',
        PREMIUM_BG[premium],
        !hasTile && !hasPreview && 'hover:brightness-110',
        highlighted && 'ring-2 ring-primary ring-offset-1 ring-offset-board-base',
      )}
    >
      {hasTile && (
        <Tile letter={tile!.letter} points={tile!.points} isBlank={tile!.isBlank} variant="board" />
      )}
      {!hasTile && hasPreview && (
        <Tile
          letter={preview!.letter}
          points={preview!.points}
          isBlank={preview!.isBlank}
          variant="preview"
        />
      )}
      {!hasTile && !hasPreview && isCentre(row, col) && (
        <Star size={20} className="text-text-dark/70" aria-hidden />
      )}
      {!hasTile && !hasPreview && !isCentre(row, col) && (
        <span className="select-none opacity-70">{PREMIUM_LABEL[premium]}</span>
      )}
    </button>
  );
}
