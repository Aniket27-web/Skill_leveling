import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Moon,
  Sun,
  Sliders,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  loadHunterProfile,
  saveHunterProfile,
  HUNTER_RANKS,
  getRankFromLevel,
  HunterProfile,
} from '../../services/skillLeveling';
import { HunterRankBadge } from '../../components/HunterRankBadge';

const PREFS_STORAGE_KEY = 'skill_leveling_user_preferences';

export interface UserPreferences {
  defaultMode: 'text' | 'audio' | 'video';
  defaultDifficulty: 'easy' | 'medium' | 'hard';
  defaultNumQuestions: number;
  speechLanguage: string;
  autoPlayAudio: boolean;
}

export function loadUserPreferences(): UserPreferences {
  const fallback: UserPreferences = {
    defaultMode: 'text',
    defaultDifficulty: 'medium',
    defaultNumQuestions: 5,
    speechLanguage: 'en-US',
    autoPlayAudio: true,
  };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {}
  return fallback;
}

export function saveUserPreferences(prefs: UserPreferences): void {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Active section tab: 'hunter' | 'interview' | 'appearance'
  const [activeTab, setActiveTab] = useState<'hunter' | 'interview' | 'appearance'>('hunter');

  // Hunter Profile State
  const [hunterProfile, setHunterProfile] = useState<HunterProfile>(loadHunterProfile);

  // User Preferences State
  const [preferences, setPreferences] = useState<UserPreferences>(loadUserPreferences);
  const [prefsSaved, setPrefsSaved] = useState<boolean>(false);

  // Query authenticated hunter info
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.ok ? res.json() : null;
    },
  });

  const handleSavePreferences = () => {
    saveUserPreferences(preferences);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2500);
  };

  const handleResetHunterMana = () => {
    if (window.confirm('Are you sure you want to recalibrate your Hunter stats to Level 10 (Rank E)?')) {
      const resetProfile: HunterProfile = {
        level: 10,
        exp: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        totalPenalties: 0,
        highestRank: 'E',
      };
      saveHunterProfile(resetProfile);
      setHunterProfile(resetProfile);
    }
  };

  const hunterRankInfo = getRankFromLevel(hunterProfile.level);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-purple-200 pb-5 dark:border-purple-900/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border dark:border-purple-800 px-2.5 py-0.5 rounded-full inline-block">
              Hunter Guild System
            </span>
            <span className="text-xs text-slate-500 dark:text-purple-400 font-mono">
              Control Panel & Arena Preferences
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono uppercase">
            System Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-purple-300/80">
            Manage your Hunter profile, interview preferences, and visual theme.
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap gap-2 border-b border-purple-100 pb-3 dark:border-purple-900/50">
        {[
          { id: 'hunter', label: 'Hunter License', icon: User },
          { id: 'interview', label: 'Arena Preferences', icon: Sliders },
          { id: 'appearance', label: 'Visual Theme', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'hunter' | 'interview' | 'appearance')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold font-mono transition ${
                isActive
                  ? 'bg-purple-700 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] dark:bg-purple-600'
                  : 'border border-purple-200/80 bg-white/70 text-slate-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-900/60 dark:bg-[#0d071a] dark:text-purple-300 dark:hover:bg-purple-950/60'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: Hunter License & Profile */}
      {activeTab === 'hunter' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-purple-100 dark:border-purple-900/40">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                    Hunter Guild Credentials
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-purple-300/70">
                    Your authenticated license and lifetime dungeon achievements.
                  </p>
                </div>
              </div>
              <HunterRankBadge level={hunterProfile.level} size="md" showDetails={true} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-purple-50/50 p-4 border border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-900/40">
                <p className="text-xs font-mono uppercase text-slate-500 dark:text-purple-400">Hunter Name</p>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {meQuery.data?.name || 'Awakened Hunter'}
                </p>
              </div>
              <div className="rounded-2xl bg-purple-50/50 p-4 border border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-900/40">
                <p className="text-xs font-mono uppercase text-slate-500 dark:text-purple-400">Guild Email Address</p>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1 font-mono">
                  {meQuery.data?.email || 'hunter@leveling.net'}
                </p>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="mt-6">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300 mb-3">
                Hunter Combat Record
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-purple-200/60 bg-white p-3.5 text-center dark:border-purple-900/40 dark:bg-[#120726]">
                  <p className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">{hunterProfile.level} / 100</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-1">Hunter Level</p>
                </div>
                <div className="rounded-2xl border border-purple-200/60 bg-white p-3.5 text-center dark:border-purple-900/40 dark:bg-[#120726]">
                  <p className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">{hunterRankInfo.rank}-Rank</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-1">{hunterRankInfo.title}</p>
                </div>
                <div className="rounded-2xl border border-purple-200/60 bg-white p-3.5 text-center dark:border-purple-900/40 dark:bg-[#120726]">
                  <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{hunterProfile.totalCorrect}</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-1">Correct Answers (+pts)</p>
                </div>
                <div className="rounded-2xl border border-purple-200/60 bg-white p-3.5 text-center dark:border-purple-900/40 dark:bg-[#120726]">
                  <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">{hunterProfile.totalPenalties}</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-1">System Penalties (-1/3)</p>
                </div>
              </div>
            </div>

            {/* Recalibrate Mana */}
            <div className="mt-6 pt-4 border-t border-purple-100 dark:border-purple-900/40 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Recalibrate Hunter Mana</p>
                <p className="text-[11px] text-slate-500 dark:text-purple-400">
                  Reset your level back to starting Rank E (Level 10) to begin a fresh leveling progression.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetHunterMana}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold font-mono text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Mana
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Arena Preferences */}
      {activeTab === 'interview' && (
        <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
          <div className="flex items-start gap-3 mb-6 pb-4 border-b border-purple-100 dark:border-purple-900/40">
            <div className="rounded-2xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                Interview Dungeon Defaults
              </h2>
              <p className="text-xs text-slate-500 dark:text-purple-300/70">
                Customize your pre-selected raid format, difficulty, and audio settings for new interview rooms.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Default Format */}
            <div>
              <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                Default Raid Arena Mode
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'text', title: 'Text Chat', desc: 'Type answers directly' },
                  { id: 'audio', title: 'Audio Call', desc: 'Hands-free voice recognition' },
                  { id: 'video', title: '3D Video Call', desc: 'Interviewer avatar & mic test' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setPreferences({ ...preferences, defaultMode: fmt.id as any })}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      preferences.defaultMode === fmt.id
                        ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950/70 dark:text-purple-100 dark:ring-purple-700'
                        : 'border-slate-200 hover:border-purple-300 dark:border-purple-900/40 dark:bg-[#120726] dark:text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold">{fmt.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-purple-400 mt-1">{fmt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Difficulty & Questions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  Default Dungeon Difficulty
                </label>
                <select
                  value={preferences.defaultDifficulty}
                  onChange={(e) => setPreferences({ ...preferences, defaultDifficulty: e.target.value as any })}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="easy">Easy Dungeon (+6 pts / -2.0 penalty)</option>
                  <option value="medium">Medium Raid (+10 pts / -3.3 penalty)</option>
                  <option value="hard">Hard Gate (+15 pts / -5.0 penalty)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  Default Question Count
                </label>
                <select
                  value={preferences.defaultNumQuestions}
                  onChange={(e) => setPreferences({ ...preferences, defaultNumQuestions: Number(e.target.value) })}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="3">3 Questions (Quick Sprint)</option>
                  <option value="5">5 Questions (Standard Raid)</option>
                  <option value="7">7 Questions (Deep Technical)</option>
                  <option value="10">10 Questions (Mastery Gate)</option>
                </select>
              </div>
            </div>

            {/* Voice & Speech Language */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  Speech Recognition Language
                </label>
                <select
                  value={preferences.speechLanguage}
                  onChange={(e) => setPreferences({ ...preferences, speechLanguage: e.target.value })}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100 font-mono"
                >
                  <option value="en-US">English (United States)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="en-AU">English (Australia)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  Voice Synthesis Auto-Play
                </label>
                <button
                  type="button"
                  onClick={() => setPreferences({ ...preferences, autoPlayAudio: !preferences.autoPlayAudio })}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition ${
                    preferences.autoPlayAudio
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 text-slate-600 dark:border-purple-900 dark:text-purple-300'
                  }`}
                >
                  <span className="font-semibold text-xs">Auto-Read AI Question</span>
                  <span className="font-mono text-xs font-bold">{preferences.autoPlayAudio ? 'ENABLED' : 'MUTED'}</span>
                </button>
              </div>
            </div>

            {/* Save Preferences Button */}
            <div className="pt-4 border-t border-purple-100 dark:border-purple-900/40 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white px-5 py-2.5 text-xs font-bold font-mono shadow transition"
              >
                <Save className="h-4 w-4" />
                Save Raid Preferences
              </button>
              {prefsSaved && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Saved!
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: Appearance & Theme */}
      {activeTab === 'appearance' && (
        <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
          <div className="flex items-start gap-3 mb-6 pb-4 border-b border-purple-100 dark:border-purple-900/40">
            <div className="rounded-2xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                Skill Leveling Arena Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-purple-300/70">
                Choose between Shadow Monarch Dark (Purple & Black) and Celestial Guild Light (Purple & White).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                if (!isDark) toggleTheme();
              }}
              className={`rounded-2xl border p-5 text-left transition ${
                isDark
                  ? 'border-purple-500 bg-[#0e071e] ring-2 ring-purple-600 shadow-[0_0_25px_rgba(147,51,234,0.3)]'
                  : 'border-slate-200 bg-slate-900 text-slate-300 hover:border-purple-500'
              }`}
            >
              <div className="flex items-center justify-between text-white mb-2">
                <span className="font-mono font-bold text-sm flex items-center gap-2">
                  <Moon className="h-4 w-4 text-purple-400" /> Shadow Monarch (Dark)
                </span>
                {isDark && (
                  <span className="text-[10px] font-mono bg-purple-600 px-2 py-0.5 rounded-full font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-200/70">
                Immersive deep black with glowing purple auras and neon accents.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDark) toggleTheme();
              }}
              className={`rounded-2xl border p-5 text-left transition ${
                !isDark
                  ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-300 shadow-[0_0_20px_rgba(147,51,234,0.2)]'
                  : 'border-slate-800 bg-white/10 text-slate-300 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center justify-between text-slate-900 dark:text-white mb-2">
                <span className="font-mono font-bold text-sm flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-500" /> Celestial Guild (Light)
                </span>
                {!isDark && (
                  <span className="text-[10px] font-mono bg-purple-700 text-white px-2 py-0.5 rounded-full font-bold">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-purple-300/70">
                Crisp white cards, sharp purple accents, and clean readability.
              </p>
            </button>
          </div>
        </section>
      )}
    </main>
  );
};

