import React from 'react';
import { clsx } from 'clsx';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ariaLabel?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  ariaLabel = 'Loading...',
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={clsx(
        'inline-block animate-spin rounded-full border-solid border-current border-t-transparent text-teal-400',
        sizes[size],
        className
      )}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};
