import React, { useState, useEffect } from 'react';
import { getRankFromLevel, HunterProfile, loadHunterProfile } from '../services/skillLeveling';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface HunterStatusBarProps {
  profile?: HunterProfile;
  lastDelta?: { delta: number; reason: string } | null;
}

const FALLBACK_PROFILE: HunterProfile = {
  level: 10,
  exp: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  totalPenalties: 0,
  highestRank: 'E',
};

export const HunterStatusBar: React.FC<HunterStatusBarProps> = ({ profile: propProfile, lastDelta }) => {
  const [localProfile, setLocalProfile] = useState<HunterProfile>(() => {
    return propProfile || loadHunterProfile() || FALLBACK_PROFILE;
  });

  useEffect(() => {
    if (propProfile) {
      setLocalProfile(propProfile);
      return;
    }

    const syncProfile = () => {
      setLocalProfile(loadHunterProfile() || FALLBACK_PROFILE);
    };

    syncProfile();
    window.addEventListener('storage', syncProfile);
    window.addEventListener('hunter_update', syncProfile);
    return () => {
      window.removeEventListener('storage', syncProfile);
      window.removeEventListener('hunter_update', syncProfile);
    };
  }, [propProfile]);

  const activeProfile = propProfile || localProfile || FALLBACK_PROFILE;
  const safeLevel = Number.isFinite(activeProfile?.level) ? Math.max(0, Math.min(100, activeProfile.level)) : 10;
  const rank = getRankFromLevel(safeLevel);
  const progressPercent = Math.min(100, Math.max(0, safeLevel));

  const totalAnswered = Number(activeProfile?.totalAnswered) || 0;
  const totalCorrect = Number(activeProfile?.totalCorrect) || 0;
  const totalPenalties = Number(activeProfile?.totalPenalties) || 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white p-4 shadow-sm dark:border-purple-900/50 dark:bg-black/80 dark:shadow-[0_0_20px_rgba(147,51,234,0.15)] transition-all">
      {/* Skill Leveling Blue/Purple Mana Glow behind */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-600/10 blur-2xl dark:bg-purple-600/20" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <span className="font-mono text-xl font-black">{rank.rank}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Hunter Status
              </span>
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                {rank.title}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                LEVEL {safeLevel.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">/ 100</span>
            </div>
          </div>
        </div>

        {/* Quick Battle Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Quests Completed</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{totalAnswered}</span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-purple-900/50" />
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Correct</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalCorrect}</span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-purple-900/50" />
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase">Penalties</span>
            <span className="font-bold text-rose-500">{totalPenalties}</span>
          </div>
        </div>
      </div>

      {/* Level Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
          <span>Rank Progress (0 to 100)</span>
          <span>{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/60">
          <div
            className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-fuchsia-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(168,85,247,0.7)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Feedback Alert Delta Notification */}
      {lastDelta && (
        <div
          className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-mono transition-all animate-fade-in ${
            lastDelta.delta > 0
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'border border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {lastDelta.delta > 0 ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{lastDelta.reason}</span>
          </div>
          <span className="font-black text-sm">
            {lastDelta.delta > 0 ? `+${lastDelta.delta}` : `${lastDelta.delta}`} LVL
          </span>
        </div>
      )}
    </div>
  );
};
