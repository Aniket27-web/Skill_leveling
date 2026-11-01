import React from 'react';
import { CountdownColorState } from '../hooks/useCountdown';

interface CountdownTimerProps {
  secondsRemaining: number;
  totalSeconds: number;
  percentRemaining: number;
  colorState: CountdownColorState;
  formattedTime: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  secondsRemaining,
  percentRemaining,
  colorState,
  formattedTime,
}) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentRemaining / 100) * circumference;

  let strokeColor = '#3B82F6'; // Blue
  let bgBadge = 'bg-blue-50 text-blue-700 border-blue-200';

  if (colorState === 'warning') {
    strokeColor = '#F59E0B'; // Amber
    bgBadge = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (colorState === 'danger') {
    strokeColor = '#EF4444'; // Red
    bgBadge = 'bg-red-50 text-red-700 border-red-200 animate-pulse';
  }

  return (
    <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-full border shadow-sm ${bgBadge}`} data-testid="countdown-timer">
      <div className="relative w-9 h-9 flex items-center justify-center">
        <svg className="w-9 h-9 -rotate-90 transform" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="text-slate-200 stroke-current"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={strokeColor}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-500 ease-linear"
          />
        </svg>
        <span className="absolute text-[11px] font-bold tracking-tight">
          {secondsRemaining <= 99 ? secondsRemaining : Math.ceil(secondsRemaining / 60) + 'm'}
        </span>
      </div>
      <div className="flex flex-col text-left pr-1">
        <span className="text-[10px] uppercase font-semibold tracking-wider opacity-75">Timer</span>
        <span className="text-xs font-bold leading-none">{formattedTime}</span>
      </div>
    </div>
  );
};
