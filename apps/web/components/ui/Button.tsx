import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-dark focus-visible:ring-primary',
  secondary:
    'bg-surface-soft text-text-dark border border-border hover:bg-border/30 focus-visible:ring-primary',
  ghost:
    'bg-transparent text-text-dark hover:bg-surface-soft focus-visible:ring-primary',
  danger:
    'bg-danger text-white shadow-sm hover:bg-danger/90 focus-visible:ring-danger',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      {...rest}
    />
  );
});
