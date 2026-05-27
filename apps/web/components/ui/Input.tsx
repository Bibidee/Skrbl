import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-dark',
          'placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);

export type SelectOption = { label: string; value: string };

type SelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function Select({ value, onChange, options, disabled, className, ...rest }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-dark',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
