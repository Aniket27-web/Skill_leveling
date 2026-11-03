import React from 'react';
import { clsx } from 'clsx';

export interface ScoreBadgeProps {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  size = 'md',
  showLabel = false,
  className,
}) => {
  const isNull = score === null || score === undefined;

  let colorStyle = 'bg-slate-800/80 text-slate-400 border-slate-700';
  let badgeLabel = 'N/A';

  if (!isNull) {
    if (score >= 80) {
      colorStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      badgeLabel = `${score}%`;
    } else if (score >= 60) {
      colorStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      badgeLabel = `${score}%`;
    } else {
      colorStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      badgeLabel = `${score}%`;
    }
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-sm px-2.5 py-1 font-semibold',
    lg: 'text-base px-3.5 py-1.5 font-bold',
  };

  return (
    <span
      data-testid="score-badge"
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border shadow-sm select-none',
        sizes[size],
        colorStyle,
        className
      )}
    >
      {showLabel && <span className="opacity-75 font-normal text-xs">Score:</span>}
      <span>{badgeLabel}</span>
    </span>
  );
};
