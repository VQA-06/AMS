import React from 'react';

export type BadgeVariant = 'emerald' | 'sky' | 'amber' | 'rose' | 'purple' | 'slate';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulse?: boolean;
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'slate',
  size = 'md',
  pulse = false,
  dot = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
    emerald: {
      bg: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 shadow-sm shadow-emerald-950/50',
      dot: 'bg-emerald-400',
    },
    sky: {
      bg: 'bg-sky-950/80 text-sky-400 border-sky-800/60 shadow-sm shadow-sky-950/50',
      dot: 'bg-sky-400',
    },
    amber: {
      bg: 'bg-amber-950/80 text-amber-400 border-amber-800/60 shadow-sm shadow-amber-950/50',
      dot: 'bg-amber-400',
    },
    rose: {
      bg: 'bg-rose-950/80 text-rose-400 border-rose-800/60 shadow-sm shadow-rose-950/50',
      dot: 'bg-rose-400',
    },
    purple: {
      bg: 'bg-purple-950/80 text-purple-300 border-purple-800/60 shadow-sm shadow-purple-950/50',
      dot: 'bg-purple-400',
    },
    slate: {
      bg: 'bg-slate-900/90 text-slate-300 border-slate-700/80',
      dot: 'bg-slate-400',
    },
  };

  const sizeStyles: Record<BadgeSize, string> = {
    xs: 'text-[10px] px-2 py-0.5 rounded-md font-semibold',
    sm: 'text-[11px] px-2.5 py-0.5 rounded-lg font-bold',
    md: 'text-xs px-2.5 py-1 rounded-xl font-semibold',
  };

  const current = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-mono select-none whitespace-nowrap shrink-0 ${current.bg} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {(pulse || dot) && (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dot}`} />
        </span>
      )}
      {icon && <span className="inline-flex items-center shrink-0">{icon}</span>}
      <span className="inline-flex items-center gap-1 leading-none whitespace-nowrap">{children}</span>
    </span>
  );
};
