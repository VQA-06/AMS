import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyber' | 'outline';
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
 * Callers pass either a rendered element (`<RefreshCw />`) or the icon
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
    // Base classes: GPU transition, focus-visible WCAG ring, touch target floor
    const baseClasses =
      'inline-flex items-center justify-center font-semibold rounded-xl sm:rounded-2xl transition-colors duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

    // Variant classes
    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-md shadow-sky-500/20 active:scale-[0.98]',
      cyber:
        'bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-lg shadow-sky-500/20 active:scale-[0.98] border border-sky-400/30',
      secondary:
        'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 active:scale-[0.98]',
      danger:
        'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-800/50 active:scale-[0.98]',
      ghost:
        'text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-[0.98]',
      outline:
        'bg-slate-900/80 hover:bg-slate-800/80 text-slate-200 border border-slate-700 active:scale-[0.98]',
    };

    // Size classes (Strict adherence to minimum 44px mobile touch target for md/lg/icon)
    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-xs min-h-[36px] gap-1.5',
      md: 'px-4 py-2.5 text-xs sm:text-sm min-h-[44px] gap-2',
      lg: 'px-5 py-3 text-sm sm:text-base min-h-[48px] gap-2.5',
      icon: 'p-2.5 min-w-[44px] min-h-[44px] gap-0 text-slate-300 hover:text-white',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
