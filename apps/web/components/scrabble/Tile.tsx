'use client';

import { cn } from '@/lib/utils/cn';

type Variant = 'rack' | 'board' | 'preview' | 'selected';

type Props = {
  letter: string;
  points: number;
  isBlank?: boolean;
  variant?: Variant;
  onClick?: () => void;
};

export function Tile({ letter, points, isBlank, variant = 'rack', onClick }: Props) {
  const interactive = Boolean(onClick);
  return (
    <span
      role={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-full w-full select-none items-center justify-center rounded-md border-2 font-bold shadow-sm',
        isBlank
          ? 'border-tile-border bg-tile-blank'
          : 'border-tile-border bg-tile-bg',
        variant === 'rack' && 'h-12 w-12 text-xl cursor-pointer hover:-translate-y-0.5 transition-transform',
        variant === 'board' && 'text-base',
        variant === 'preview' && 'text-base opacity-90 ring-2 ring-primary',
        variant === 'selected' && 'h-12 w-12 text-xl ring-2 ring-primary',
      )}
    >
      <span className="text-tile-text">{letter || ' '}</span>
      {!isBlank && points > 0 && (
        <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-tile-score">
          {points}
        </span>
      )}
    </span>
  );
}
