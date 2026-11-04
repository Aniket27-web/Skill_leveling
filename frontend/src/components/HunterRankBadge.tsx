import React from 'react';
import { getRankFromLevel, HunterRank } from '../services/skillLeveling';
import { Zap, ShieldAlert, Award, Skull, Crown } from 'lucide-react';

interface HunterRankBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const HunterRankBadge: React.FC<HunterRankBadgeProps> = ({
  level,
  size = 'md',
  showDetails = true,
}) => {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 10;
  const rankInfo = getRankFromLevel(safeLevel);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base font-bold',
  };

  const getRankIcon = (rank: HunterRank) => {
    switch (rank) {
      case 'S':
        return <Crown className="h-4 w-4 text-purple-300 animate-pulse" />;
      case 'A':
        return <Award className="h-4 w-4 text-indigo-300" />;
      case 'B':
        return <Zap className="h-4 w-4 text-fuchsia-300" />;
      case 'C':
        return <ShieldAlert className="h-4 w-4 text-purple-400" />;
      default:
        return <Skull className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${rankInfo.borderClass} ${rankInfo.badgeBg} ${rankInfo.badgeText} ${sizeClasses[size]} font-mono font-bold tracking-wider ${rankInfo.glowColor} transition-all duration-300`}
      >
        {getRankIcon(rankInfo.rank)}
        <span>RANK {rankInfo.rank}</span>
      </div>

      {showDetails && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-tight text-purple-600 dark:text-purple-400 font-mono">
              LVL {Math.round(safeLevel)}/100
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            {rankInfo.title}
          </span>
        </div>
      )}
    </div>
  );
};

