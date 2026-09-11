import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`glass-panel rounded-3xl p-8 sm:p-12 text-center border border-slate-800/80 flex flex-col items-center justify-center animate-in fade-in duration-200 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/10 ring-4 ring-sky-500/5">
        {React.isValidElement(icon) ? (
          icon
        ) : typeof icon === 'function' || (typeof icon === 'object' && icon !== null) ? (
          React.createElement(icon as React.ComponentType<{ className?: string }>, {
            className: 'w-8 h-8',
          })
        ) : (
          icon
        )}
      </div>
      <h4 className="font-heading font-bold text-base sm:text-lg text-white max-w-md">{title}</h4>
      <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md leading-relaxed">{description}</p>

      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {actionText && onAction && (
            <Button variant="primary" size="md" icon={actionIcon} onClick={onAction}>
              {actionText}
            </Button>
          )}
          {secondaryActionText && onSecondaryAction && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
