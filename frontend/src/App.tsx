import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  User,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Sword,
  Flame,
  Loader2,
  Zap,
  Shield,
  Sparkles,
  FileText,
  Video,
  Mic,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Award,
  ArrowRight,
  Target,
  Settings,
} from 'lucide-react';
import { clearAISettings } from './api/aiSettings';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { loadHunterProfile, HUNTER_RANKS } from './services/skillLeveling';
import { HunterRankBadge } from './components/HunterRankBadge';
import logoImg from './assests/logo/Skill Leveling Growth Emblem.png';

const InterviewPage = lazy(() => import('./pages/interview/InterviewPage').then((module) => ({ default: module.InterviewPage })));
const SummaryPage = lazy(() => import('./pages/summary/SummaryPage').then((module) => ({ default: module.SummaryPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AISettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

const AppContent: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [hunterLevel, setHunterLevel] = useState<number>(10);

  // Sync hunter profile
  const syncHunter = () => {
    const p = loadHunterProfile();
    setHunterLevel(p.level);
  };

  useEffect(() => {
    syncHunter();
    window.addEventListener('storage', syncHunter);
    return () => window.removeEventListener('storage', syncHunter);
  }, []);

  // Check current session on mount
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError(null);
    try {
      if (isRegister) {
        const registerResponse = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        });
        if (!registerResponse.ok) {
          const err = await registerResponse.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'Could not awaken your hunter account');
        }
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Invalid hunter credentials');
      }
      const data = await res.json();
      setCurrentUser(data);
      setShowLoginModal(false);
      setIsRegister(false);
      queryClient.invalidateQueries();
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    }
  };

  const [demoLoading, setDemoLoading] = useState<boolean>(false);

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setLoginError(null);
    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'demo@example.com', password: 'password123' }),
      });
      if (!res.ok) {
        // In case the DB was fresh, auto-register demo account
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: 'Demo Hunter', email: 'demo@example.com', password: 'password123' }),
        });
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: 'demo@example.com', password: 'password123' }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Invalid demo credentials');
      }
      const data = await res.json();
      setCurrentUser(data);
      setShowLoginModal(false);
      setIsRegister(false);
      queryClient.invalidateQueries();
    } catch (err: any) {
      setLoginError(err?.message || 'Demo login failed');
      setShowLoginModal(true);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setCurrentUser(null);
      clearAISettings();
      queryClient.clear();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#07030e] dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Skill Leveling Global Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-purple-200 bg-white/90 backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0a0515]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative flex items-center">
              {/* Soft purple backlight aura */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600/35 via-fuchsia-500/25 to-indigo-600/35 blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center h-10 px-2.5 py-1 rounded-xl bg-white/90 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80 shadow-[0_0_15px_rgba(147,51,234,0.2)] backdrop-blur-sm transition-transform group-hover:scale-105">
                <img
                  src={logoImg}
                  alt="Skill Leveling Emblem"
                  className="h-7 w-auto object-contain drop-shadow-[0_2px_8px_rgba(147,51,234,0.35)]"
                />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-700 dark:bg-purple-950 dark:border dark:border-purple-800 dark:text-purple-300 font-mono">
                  SYSTEM v1.2
                </span>
                <span className="text-[11px] text-slate-500 dark:text-purple-300/70 font-mono tracking-tight">
                  AI Technical Interview Arena
                </span>
              </div>
            </div>
          </Link>

          {/* User & Rank Controls */}
          <div className="flex items-center space-x-3">
            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-purple-200 p-2 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/60 transition shadow-sm"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {authLoading ? (
              <span className="text-xs text-slate-400 font-mono">Syncing mana...</span>
            ) : currentUser ? (
              <div className="flex items-center space-x-2">
                {/* Hunter Rank Badge Widget - Only shown when authenticated */}
                <div className="hidden md:flex">
                  <HunterRankBadge level={hunterLevel} size="sm" showDetails={true} />
                </div>
                <Link
                  to="/"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 dark:text-slate-300 dark:hover:bg-purple-950/50"
                >
                  Dungeon
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 dark:text-slate-300 dark:hover:bg-purple-950/50"
                >
                  <Settings className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  Settings
                </Link>
                <div className="flex items-center space-x-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-900 border border-purple-200 dark:bg-purple-950/70 dark:border-purple-800 dark:text-purple-300 font-mono">
                  <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold">{currentUser.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-purple-950/60 dark:hover:text-purple-300 transition"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsRegister(false);
                  setShowLoginModal(true);
                }}
                className="inline-flex items-center rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_12px_rgba(147,51,234,0.5)] hover:bg-purple-700 transition"
              >
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Awaken Hunter
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-16">
        {authLoading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-10 w-10 text-purple-600 animate-spin mb-4" />
            <p className="font-mono text-sm uppercase tracking-wider text-purple-600 dark:text-purple-400">
              [SYSTEM: VERIFYING HUNTER CREDENTIALS...]
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="mx-auto max-w-7xl px-6 py-20 text-center font-mono text-sm text-purple-600 dark:text-purple-400 animate-pulse">
                [SYSTEM: LOADING DUNGEON GATES...]
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  currentUser ? (
                    <DashboardPage />
                  ) : (
                    <div className="relative overflow-hidden">
                      {/* Atmospheric Ambient Lighting / Backdrop Gradients */}
                      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[950px] rounded-full bg-gradient-to-b from-purple-500/15 via-indigo-500/10 to-transparent blur-3xl -z-10 dark:from-purple-600/25 dark:via-fuchsia-600/10" />

                      {/* Hero Section */}
                      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 text-center">
                        {/* System Badge */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/80 bg-purple-100/70 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-800 backdrop-blur dark:border-purple-800/80 dark:bg-purple-950/80 dark:text-purple-300 shadow-sm">
                          <Flame className="h-3.5 w-3.5 text-purple-600 animate-bounce" />
                          <span>The Leveling System Has Chosen You · Enter The Gate</span>
                        </div>

                        {/* Logo with Illuminated Backlight Halo */}
                        <div className="relative mx-auto my-7 flex justify-center">
                          {/* Deep Ambient Backlight Glow */}
                          <div className="absolute -inset-6 sm:-inset-10 bg-gradient-to-tr from-purple-600/40 via-fuchsia-500/30 to-indigo-600/40 rounded-full blur-3xl opacity-90 animate-pulse pointer-events-none" />
                          {/* Soft Inner Glow Backing */}
                          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-purple-500/25 via-fuchsia-500/25 to-indigo-500/25 blur-lg pointer-events-none" />
                          {/* Frosted Glass Emblem Stage */}
                          <div className="relative z-10 flex items-center justify-center rounded-3xl border border-purple-200/90 bg-white/85 px-8 py-5 shadow-[0_12px_45px_rgba(147,51,234,0.22)] backdrop-blur-xl dark:border-purple-700/60 dark:bg-[#120726]/85 dark:shadow-[0_0_55px_rgba(147,51,234,0.45)] hover:scale-[1.03] transition-all duration-300 group">
                            <img
                              src={logoImg}
                              alt="Skill Leveling Growth Emblem"
                              className="h-24 sm:h-32 w-auto max-w-[340px] object-contain drop-shadow-[0_6px_24px_rgba(147,51,234,0.35)]"
                            />
                          </div>
                        </div>

                        {/* Hero Headline & Subtitle */}
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white font-mono uppercase leading-tight">
                          Conquer Technical Raids.<br />
                          <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-purple-400 dark:via-indigo-300 dark:to-fuchsia-400">
                            Rise to S-Rank Monarch.
                          </span>
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-purple-200/80">
                          The premier gamified technical interview arena. Upload your resume, face adaptive AI challenges across Text, Audio, and 3D Video dungeons, and earn real hunter levels (0–100) with honest scoring and penalty stakes.
                        </p>

                        {/* CTAs & 1-Click Demo */}
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                          <button
                            onClick={() => {
                              setIsRegister(false);
                              setShowLoginModal(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 px-7 py-3.5 font-mono text-sm font-bold text-white shadow-[0_0_25px_rgba(147,51,234,0.5)] hover:scale-105 hover:from-purple-600 hover:to-indigo-500 transition-all duration-200"
                          >
                            <Sword className="h-4 w-4" />
                            Awaken Hunter · Start Raid
                          </button>
                          <button
                            onClick={handleDemoLogin}
                            disabled={demoLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-purple-300 bg-white/90 px-6 py-3.5 font-mono text-sm font-bold text-purple-700 shadow-sm hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 transition disabled:opacity-60"
                          >
                            {demoLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                            ) : (
                              <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            )}
                            {demoLoading ? 'Entering Dungeon...' : '1-Click Evaluator Demo'}
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-purple-400/70 font-mono">
                          <span>💡 Demo Credentials:</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">demo@example.com</span>
                          <span>/</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">password123</span>
                        </div>

                        {/* Metric Highlights */}
                        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto">
                          <div className="rounded-2xl border border-purple-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/80 text-center">
                            <p className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">0–100</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-purple-300/70 mt-1">Leveling Progression</p>
                          </div>
                          <div className="rounded-2xl border border-purple-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/80 text-center">
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">E → S Rank</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-purple-300/70 mt-1">Hunter Tier System</p>
                          </div>
                          <div className="rounded-2xl border border-purple-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/80 text-center">
                            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">-1/3 Pts</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-purple-300/70 mt-1">Penalty on Failure</p>
                          </div>
                          <div className="rounded-2xl border border-purple-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/80 text-center">
                            <p className="text-2xl font-black text-fuchsia-600 dark:text-fuchsia-400 font-mono">3 Modes</p>
                            <p className="text-xs font-medium text-slate-500 dark:text-purple-300/70 mt-1">Text · Voice · 3D Video</p>
                          </div>
                        </div>

                        {/* Hunter Rank Progression Ladder Showcase */}
                        <div className="mt-16 text-left max-w-5xl mx-auto">
                          <div className="text-center mb-8">
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                              System Hunter Hierarchy
                            </span>
                            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                              The 6 Hunter Ranks
                            </h2>
                            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-purple-300/70">
                              Your interview performance directly dictates your hunter standing in the guild registry.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((rKey) => {
                              const r = HUNTER_RANKS[rKey];
                              return (
                                <div
                                  key={rKey}
                                  className={`rounded-2xl border p-4 backdrop-blur-sm transition-all hover:-translate-y-1 ${
                                    rKey === 'S'
                                      ? 'border-purple-500/80 bg-gradient-to-b from-purple-950/40 to-[#120726] shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                                      : rKey === 'A'
                                      ? 'border-indigo-400/60 bg-white/70 dark:bg-[#0e071f]/80'
                                      : 'border-purple-200/60 bg-white/60 dark:border-purple-900/40 dark:bg-[#0c0517]/60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xl font-black text-purple-700 dark:text-purple-300">
                                      {r.rank}-Rank
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-purple-400">
                                      LVL {r.minLevel}–{r.maxLevel}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                    {r.title}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3 Core System Pillars */}
                        <div className="mt-16 text-left max-w-5xl mx-auto">
                          <div className="text-center mb-8">
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                              Core Dungeon Architecture
                            </span>
                            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                              How Skill Leveling Operates
                            </h2>
                          </div>

                          <div className="grid gap-6 md:grid-cols-3">
                            <div className="rounded-3xl border border-purple-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/90">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 mb-4 border border-purple-200 dark:border-purple-800">
                                <FileText className="h-6 w-6" />
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">1. Resume Ingestion</h3>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-purple-300/80">
                                Upload your PDF or DOCX resume. The engine parses your technologies, production projects, and work tenure to generate questions relevant to your actual experience.
                              </p>
                            </div>

                            <div className="rounded-3xl border border-purple-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/90">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 mb-4 border border-indigo-200 dark:border-indigo-800">
                                <Video className="h-6 w-6" />
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">2. Multi-Modal Raids</h3>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-purple-300/80">
                                Enter your preferred format: Text chat with draft preservation, hands-free Audio call with voice synthesis, or 3D Avatar video interview with microphone audible check.
                              </p>
                            </div>

                            <div className="rounded-3xl border border-purple-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0e071c]/90">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-700 dark:text-fuchsia-300 mb-4 border border-fuchsia-200 dark:border-fuchsia-800">
                                <Award className="h-6 w-6" />
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono">3. Real-Time Debrief</h3>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-purple-300/80">
                                Receive structured 0–10 evaluations for every answer. Correct solutions yield level points, poor answers inflict -1/3 penalty. Export session reports as downloadable PDFs.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Simulated Raid Preview */}
                        <div className="mt-16 text-left max-w-4xl mx-auto rounded-3xl border border-purple-300/70 bg-white/90 p-6 sm:p-8 shadow-xl backdrop-blur dark:border-purple-800/80 dark:bg-[#0d061a]/90">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/50 pb-4">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-purple-700 px-2 py-0.5 text-[10px] font-bold font-mono text-white">CHALLENGE Q1</span>
                              <span className="text-xs font-mono text-slate-500 dark:text-purple-400">Target: Distributed Systems Engineer</span>
                            </div>
                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              EVALUATION: 8.8 / 10 · +2.4 LVL GAINED
                            </span>
                          </div>

                          <div className="mt-4">
                            <p className="font-mono text-xs uppercase tracking-wider text-purple-700 dark:text-purple-400 font-bold">
                              🎙️ AI Interviewer Challenge:
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              "In your microservices architecture project, how did you guarantee transaction atomicity across decoupled payment and inventory services without creating distributed deadlocks?"
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 p-4 border border-purple-200/60 dark:border-purple-900/40 text-xs">
                            <div>
                              <p className="font-bold text-emerald-700 dark:text-emerald-400 font-mono mb-1 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Strengths Identified:
                              </p>
                              <p className="text-slate-700 dark:text-purple-200">
                                Excellent implementation of the Saga orchestrator pattern and idempotency tokens.
                              </p>
                            </div>
                            <div>
                              <p className="font-bold text-amber-700 dark:text-amber-400 font-mono mb-1 flex items-center gap-1">
                                <Target className="h-3.5 w-3.5" /> Areas to Improve:
                              </p>
                              <p className="text-slate-700 dark:text-purple-200">
                                Quantify compensate-transaction latencies and mention dead-letter queue telemetry.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Bottom CTA Section */}
                        <div className="mt-16 text-center">
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono uppercase">
                            Ready to Begin Your Awakening?
                          </h3>
                          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-purple-300/70">
                            Create your hunter license now or access the live demo dungeon instantly.
                          </p>
                          <div className="mt-6 flex justify-center gap-4">
                            <button
                              onClick={() => {
                                setIsRegister(true);
                                setShowLoginModal(true);
                              }}
                              className="rounded-xl bg-purple-600 px-6 py-3 font-mono text-xs font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.6)] hover:bg-purple-700 transition"
                            >
                              Register Hunter License
                            </button>
                            <button
                              onClick={handleDemoLogin}
                              disabled={demoLoading}
                              className="rounded-xl border border-purple-300 bg-white px-6 py-3 font-mono text-xs font-bold text-purple-700 shadow-sm hover:bg-purple-50 dark:border-purple-800 dark:bg-[#150a2b] dark:text-purple-300 transition disabled:opacity-60"
                            >
                              {demoLoading ? 'Entering Dungeon...' : '1-Click Demo Login'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
              />
              <Route path="/dashboard" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/sessions/new" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/history" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/settings" element={currentUser ? <SettingsPage /> : <Navigate to="/" replace />} />
              <Route path="/settings/ai" element={<Navigate to="/settings" replace />} />
              <Route path="/interview/:id" element={<InterviewPage />} />
              <Route path="/summary/:id" element={<SummaryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-purple-300 bg-white p-6 shadow-2xl dark:border-purple-900 dark:bg-[#0c0618]">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-1 rounded-xl bg-purple-500/30 blur-sm" />
                <img src={logoImg} alt="Emblem" className="relative h-9 w-auto max-w-[120px] object-contain drop-shadow-[0_0_10px_rgba(147,51,234,0.6)]" />
              </div>
              <div>
                <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {isRegister ? 'Hunter Awakening' : 'Hunter Authorization'}
                </h3>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                  Skill Leveling Gate System
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-mono">
              {isRegister ? 'Register your hunter license to track ranks.' : 'Enter your credentials to enter the dungeon.'}
            </p>

            {/* Quick Demo Credentials Autofill Pill */}
            {!isRegister && (
              <div className="mb-3 space-y-2">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={demoLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 p-2.5 font-mono text-xs font-bold text-white shadow-md hover:from-purple-600 hover:to-indigo-500 transition disabled:opacity-60"
                >
                  {demoLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  {demoLoading ? 'Authorizing Demo Hunter...' : '⚡ 1-Click Demo Login (Instant)'}
                </button>
                <div className="rounded-xl border border-purple-200/80 bg-purple-50/70 p-2 text-xs dark:border-purple-900/60 dark:bg-purple-950/40 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300">
                    Credentials: demo@example.com / password123
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('demo@example.com');
                      setPassword('password123');
                    }}
                    className="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-purple-500 transition"
                  >
                    Fill
                  </button>
                </div>
              </div>
            )}

            {loginError && (
              <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3 font-mono text-xs">
              {isRegister && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Hunter Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Sung Jin-woo"
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-purple-900 dark:text-white outline-none focus:border-purple-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hunter@leveling.net"
                  className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-purple-900 dark:text-white outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">Password</label>
                <input
                  type="password"
                  minLength={isRegister ? 8 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 dark:border-purple-900 dark:text-white outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setLoginError(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-purple-900/60 p-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                >
                  {isRegister ? 'Sign in' : 'Create License'}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-purple-600 p-2 font-bold text-white shadow-md hover:bg-purple-700 transition"
                >
                  {isRegister ? 'Awaken' : 'Authorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
