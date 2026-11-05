import React from 'react';
import { getRankFromLevel, HunterRank } from '../services/skillLeveling';
import { Zap, ShieldAlert, Award, Skull, Crown, Sparkles } from 'lucide-react';

interface HunterRankBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export const HunterRankBadge: React.FC<HunterRankBadgeProps> = ({
  level,
  size = 'md',
  showDetails = true,
  className = '',
}) => {
  const safeLevel = Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 10;
  const rankInfo = getRankFromLevel(safeLevel);

  const getRankIcon = (rank: HunterRank, iconClass: string) => {
    switch (rank) {
      case 'S':
        return <Crown className={`${iconClass} text-amber-500 dark:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse`} />;
      case 'A':
        return <Award className={`${iconClass} text-indigo-600 dark:text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.5)]`} />;
      case 'B':
        return <Zap className={`${iconClass} text-fuchsia-600 dark:text-fuchsia-300 drop-shadow-[0_0_6px_rgba(217,70,239,0.5)]`} />;
      case 'C':
        return <ShieldAlert className={`${iconClass} text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]`} />;
      case 'D':
        return <Sparkles className={`${iconClass} text-blue-600 dark:text-blue-300 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]`} />;
      default:
        return <Skull className={`${iconClass} text-slate-600 dark:text-slate-300 drop-shadow-[0_0_4px_rgba(148,163,184,0.3)]`} />;
    }
  };

  // If details are disabled, show standalone rank badge pill
  if (!showDetails) {
    const badgeSizes = {
      sm: 'px-2.5 py-0.5 text-[11px] gap-1.5',
      md: 'px-3 py-1 text-xs sm:text-sm gap-2',
      lg: 'px-4 py-2 text-sm sm:text-base font-bold gap-2.5',
    };
    const iconSizes = {
      sm: 'h-3.5 w-3.5',
      md: 'h-4 w-4',
      lg: 'h-5 w-5',
    };

    return (
      <div
        className={`inline-flex items-center rounded-xl border ${rankInfo.borderClass} ${rankInfo.badgeBg} ${rankInfo.badgeText} ${badgeSizes[size]} font-mono font-bold tracking-wider ${rankInfo.glowColor} transition-all duration-300 shadow-sm ${className}`}
      >
        {getRankIcon(rankInfo.rank, iconSizes[size])}
        <span>RANK {rankInfo.rank}</span>
      </div>
    );
  }

  // Compact size for top navigation bar (size="sm")
  if (size === 'sm') {
    return (
      <div
        className={`group relative inline-flex items-center gap-2.5 rounded-2xl border border-purple-200/90 bg-white/90 px-2.5 py-1 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-purple-400/80 hover:shadow-[0_0_16px_rgba(147,51,234,0.18)] dark:border-purple-900/60 dark:bg-purple-950/30 dark:shadow-[0_0_14px_rgba(147,51,234,0.12)] dark:hover:border-purple-700/80 ${className}`}
      >
        {/* Subtle ambient hover glow */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-fuchsia-500/10 to-indigo-500/15 opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

        {/* Rank Badge Pill */}
        <div
          className={`relative inline-flex items-center gap-1.5 rounded-xl border ${rankInfo.borderClass} ${rankInfo.badgeBg} ${rankInfo.badgeText} px-2 py-0.5 font-mono text-[11px] font-extrabold tracking-wider ${rankInfo.glowColor} transition-transform duration-200 group-hover:scale-105 shadow-xs`}
        >
          {getRankIcon(rankInfo.rank, 'h-3.5 w-3.5')}
          <span>RANK {rankInfo.rank}</span>
        </div>

        {/* Vertical divider */}
        <div className="h-4 w-px bg-purple-200/90 dark:bg-purple-800/70" />

        {/* Level and Title details */}
        <div className="relative flex flex-col justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-mono text-[11px] font-black tracking-tight text-purple-700 dark:text-purple-300">
              LVL {Math.round(safeLevel)}
            </span>
            <span className="font-mono text-[9px] text-slate-400 dark:text-purple-400/60">/100</span>

            {/* Micro XP Progress Bar */}
            <div className="h-1.5 w-10 sm:w-12 overflow-hidden rounded-full bg-slate-200/80 dark:bg-purple-950/90 border border-slate-300/40 dark:border-purple-800/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.max(4, safeLevel)}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-purple-300/80 leading-tight mt-0.5 max-w-[130px] truncate font-mono">
            {rankInfo.title}
          </span>
        </div>
      </div>
    );
  }

  // Medium / Large size for Settings and Summary views (size="md" | "lg")
  return (
    <div
      className={`group relative inline-flex items-center gap-3.5 rounded-2xl border border-purple-200/90 bg-white/90 p-2 pr-4 backdrop-blur-md shadow-sm transition-all duration-300 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(147,51,234,0.2)] dark:border-purple-900/60 dark:bg-purple-950/40 dark:shadow-[0_0_18px_rgba(147,51,234,0.15)] dark:hover:border-purple-700 ${className}`}
    >
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-fuchsia-500/15 to-indigo-500/15 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      {/* Rank Pill */}
      <div
        className={`relative inline-flex items-center gap-2 rounded-xl border ${rankInfo.borderClass} ${rankInfo.badgeBg} ${rankInfo.badgeText} px-3 py-1.5 font-mono text-xs sm:text-sm font-black tracking-wider ${rankInfo.glowColor} transition-transform duration-200 group-hover:scale-105 shadow-sm`}
      >
        {getRankIcon(rankInfo.rank, size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')}
        <span>RANK {rankInfo.rank}</span>
      </div>

      {/* Vertical divider */}
      <div className="h-6 w-px bg-purple-200/90 dark:bg-purple-800/70" />

      {/* Level and Title details */}
      <div className="relative flex flex-col justify-center">
        <div className="flex items-center gap-2 leading-none">
          <span className="font-mono text-xs sm:text-sm font-black tracking-tight text-purple-700 dark:text-purple-300">
            LVL {Math.round(safeLevel)}
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-purple-400/60">/100</span>

          {/* Micro XP Progress Bar */}
          <div className="h-2 w-16 sm:w-20 overflow-hidden rounded-full bg-slate-200/80 dark:bg-purple-950/90 border border-slate-300/40 dark:border-purple-800/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.max(4, safeLevel)}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-purple-300/80 leading-tight mt-1 font-mono">
          {rankInfo.title}
        </span>
      </div>
    </div>
  );
};
