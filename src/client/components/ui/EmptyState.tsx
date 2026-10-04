import React from 'react';
import { cn } from '../../lib/cn';
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
  /**
   * Level of the title element. Defaults to `3` so an empty state rendered
   * under a page `<h1>` does not silently skip a heading level; pass `2` when
   * it heads a whole section, `4` only when a level 3 is already above it.
   */
  headingLevel?: 2 | 3 | 4;
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
  headingLevel = 3,
  className,
}) => {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <div
      className={cn(
        'surface rounded-panel px-8 py-10 text-center sm:px-12 sm:py-14',
        'flex flex-col items-center justify-center',
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-panel border border-pen-200 bg-pen-50/70 text-ink-2 [&>svg]:h-8 [&>svg]:w-8">
        {React.isValidElement(icon) ? (
          icon
        ) : typeof icon === 'function' || (typeof icon === 'object' && icon !== null) ? (
          React.createElement(icon as React.ComponentType<{ className?: string }>, {
            className: 'h-8 w-8',
          })
        ) : (
          icon
        )}
      </div>
      <Heading className="max-w-md font-heading text-base font-bold text-ink sm:text-lg">
        {title}
      </Heading>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-ink-2 sm:text-sm">{description}</p>

      {(actionText || secondaryActionText) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
