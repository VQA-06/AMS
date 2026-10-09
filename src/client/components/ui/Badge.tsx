import React from 'react';
import { cn } from '../../lib/cn';

/**
 * Hues map to state, never to decoration. `seal` present/active, `pen`
 * action/breach, `pending` draft/warning, `danger` error/destructive, `info`
 * neutral informational, `neutral` inactive/unknown.
 *
 * On paper these are tinted washes with a deep text step; each pair clears
 * WCAG AA against its own background.
 */
export type BadgeVariant = 'seal' | 'pen' | 'pending' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Callers pass either a rendered element (`<Users />`) or the icon component
 * itself. React cannot render a bare component as a child, so that form is
 * instantiated here rather than crashing the tree. Covers both plain function
 * components and `forwardRef` icons, which are objects with a `render` key.
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
    return <Icon className="w-3.5 h-3.5" />;
  }
  return icon;
}

const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
  seal: {
    bg: 'bg-seal-50 text-seal-800 border-seal-200',
    dot: 'bg-seal-500',
  },
  pen: {
    bg: 'bg-pen-50 text-pen-deep border-pen-200',
    dot: 'bg-pen-500',
  },
  pending: {
    bg: 'bg-pending-50 text-pending-800 border-pending-200',
    dot: 'bg-pending-500',
  },
  danger: {
    bg: 'bg-pen-50 text-pen-deep border-pen-200',
    dot: 'bg-pen-500',
  },
  info: {
    bg: 'bg-info-50 text-info-700 border-info-200',
    dot: 'bg-info-500',
  },
  neutral: {
    bg: 'bg-paper-sunk text-ink-2 border-rule-strong',
    dot: 'bg-rule-strong',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-2 py-0.5 rounded-chip font-bold',
  sm: 'text-[11px] px-2.5 py-0.5 rounded-chip font-bold',
  md: 'text-xs px-2.5 py-1 rounded-chip font-bold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'xs',
  dot = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const current = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border select-none whitespace-nowrap shrink-0',
        current.bg,
        sizeStyles[size],
        className
      )}
      data-variant={variant}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={cn('relative inline-flex rounded-full h-2 w-2', current.dot)} />
        </span>
      )}
      {icon && (
        <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{renderIcon(icon)}</span>
      )}
      {children}
    </span>
  );
};
