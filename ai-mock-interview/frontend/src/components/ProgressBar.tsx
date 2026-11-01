import React from 'react';
import { clsx } from 'clsx';

export interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'teal' | 'emerald' | 'amber' | 'rose' | 'blue';
  className?: string;
  ariaLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  color = 'teal',
  className,
  ariaLabel,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colorStyles = {
    teal: 'bg-gradient-to-r from-teal-500 to-emerald-400',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    amber: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    rose: 'bg-gradient-to-r from-rose-500 to-red-400',
    blue: 'bg-gradient-to-r from-blue-500 to-indigo-400',
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-300 mb-1.5">
          {label && <span>{label}</span>}
          {showValue && <span className="text-slate-400 tabular-nums">{percentage}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || label || 'Progress'}
        className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50 shadow-inner"
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-300 ease-out', colorStyles[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
