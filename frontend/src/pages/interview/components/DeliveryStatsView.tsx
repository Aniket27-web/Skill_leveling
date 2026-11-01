import React from 'react';
import { DeliveryStats } from '../hooks/useDeliveryStats';
import { Activity, MessageSquare } from 'lucide-react';

interface DeliveryStatsViewProps {
  stats: DeliveryStats;
}

export const DeliveryStatsView: React.FC<DeliveryStatsViewProps> = ({ stats }) => {
  const { wordCount, charCount, fillerStats, wpm, paceRating } = stats;

  return (
    <div
      className="flex flex-wrap items-center gap-3 text-xs text-slate-500 py-1.5 px-3 bg-slate-50/80 rounded-lg border border-slate-200/80"
      data-testid="delivery-stats-bar"
    >
      <div className="flex items-center space-x-1.5 font-medium text-slate-600">
        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
        <span>
          <strong className="text-slate-800">{wordCount}</strong> words
        </span>
        <span className="text-slate-300">•</span>
        <span>
          <strong className="text-slate-800">{charCount}</strong>/4000 chars
        </span>
      </div>

      <div className="h-3 w-px bg-slate-200 hidden sm:block" />

      {/* Live Words-Per-Minute */}
      <div className="flex items-center space-x-1.5">
        <Activity className="h-3.5 w-3.5 text-blue-500" />
        <span>
          Pace: <strong className="text-slate-800">{wpm}</strong> WPM
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            paceRating === 'optimal'
              ? 'bg-emerald-100 text-emerald-800'
              : paceRating === 'deliberate'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {paceRating}
        </span>
      </div>

      <div className="h-3 w-px bg-slate-200 hidden sm:block" />

      {/* Filler Words */}
      <div className="flex items-center space-x-1.5">
        <span>
          Fillers: <strong className="text-slate-800">{fillerStats.total}</strong>
        </span>
        {fillerStats.total > 0 && (
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
            {fillerStats.breakdown.um > 0 && `um:${fillerStats.breakdown.um} `}
            {fillerStats.breakdown.uh > 0 && `uh:${fillerStats.breakdown.uh} `}
            {fillerStats.breakdown.like > 0 && `like:${fillerStats.breakdown.like}`}
          </span>
        )}
      </div>
    </div>
  );
};
