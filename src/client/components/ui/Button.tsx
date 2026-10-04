import React from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Callers pass either a rendered element (`<ArrowClockwise />`) or the icon
 * component itself. React cannot render a bare component as a child, so that
 * form is instantiated here rather than crashing the tree. Covers both plain
 * function components and `forwardRef` icons, which are objects with a `render`
 * key.
 */
function renderIcon(icon: React.ReactNode): React.ReactNode {
  if (React.isValidElement(icon)) return icon;

  const isComponent =
    typeof icon === 'function' ||
    (typeof icon === 'object' &&
      icon !== null &&
      'render' in (icon as unknown as Record<string, unknown>));

  if (isComponent) {
    const Icon = icon as unknown as React.ComponentType<{ className?: string }>;
    return <Icon className="w-4 h-4" />;
  }
  return icon;
}

/** One focus quartet on every variant: never `focus:outline-none` alone. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

const variantClasses: Record<ButtonVariant, string> = {
  // Ink is the action fill on paper; `pen` is reserved for breach, so a CTA can
  // never be read as a warning. A reversed fill uses `paper` on `ink`
  // (15.71:1) — `pen` on `ink` would measure 2.94:1.
  primary: 'bg-ink text-paper font-bold hover:bg-ink-2',
  secondary:
    'bg-paper-sunk text-ink border border-rule hover:bg-rule/40 hover:border-rule-strong',
  outline:
    'bg-transparent text-ink border border-rule-strong hover:bg-paper-sunk/70',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-paper-sunk/70',
  danger: 'bg-pen text-paper font-bold hover:bg-pen-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px] gap-1.5 rounded-chip',
  md: 'px-4 py-2.5 text-xs sm:text-sm min-h-[44px] gap-2 rounded-chip',
  lg: 'px-5 py-3 text-sm sm:text-base min-h-[48px] gap-2.5 rounded-chip',
  icon: 'p-2.5 min-w-[44px] min-h-[44px] gap-0 rounded-chip',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText = 'Memproses…',
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        data-variant={variant}
        className={cn(
          'inline-flex items-center justify-center font-semibold select-none',
          'transition-colors duration-150 ease-out-expo active:scale-[0.98]',
          'disabled:opacity-50 disabled:pointer-events-none',
          focusRing,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            {size !== 'icon' && <span>{loadingText}</span>}
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{renderIcon(icon)}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
