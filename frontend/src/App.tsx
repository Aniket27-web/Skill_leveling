import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { User, LogIn, LogOut, Moon, Sun, Sword, Flame, Loader2 } from 'lucide-react';
import { clearAISettings } from './api/aiSettings';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { loadHunterProfile } from './services/skillLeveling';
import { HunterRankBadge } from './components/HunterRankBadge';

const InterviewPage = lazy(() => import('./pages/interview/InterviewPage').then((module) => ({ default: module.InterviewPage })));
const SummaryPage = lazy(() => import('./pages/summary/SummaryPage').then((module) => ({ default: module.SummaryPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const AISettingsPage = lazy(() => import('./pages/settings/AISettingsPage').then((module) => ({ default: module.AISettingsPage })));

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
      {/* Solo Leveling Purple Global Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-purple-200 bg-white/90 backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0a0515]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] transition-transform group-hover:scale-105">
              <Sword className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider uppercase font-mono bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-purple-400 dark:via-indigo-300 dark:to-fuchsia-400">
                  Skill Leveling
                </span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-700 dark:bg-purple-950 dark:border dark:border-purple-800 dark:text-purple-300">
                  SYSTEM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-purple-300/70 font-mono tracking-tight hidden sm:block">
                Solo Leveling Inspired Technical Arena
              </p>
            </div>
          </Link>

          {/* User & Rank Controls */}
          <div className="flex items-center space-x-3">
            {/* Hunter Rank Badge Widget */}
            <div className="hidden md:flex">
              <HunterRankBadge level={hunterLevel} size="sm" showDetails={true} />
            </div>

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
                <Link
                  to="/"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 dark:text-slate-300 dark:hover:bg-purple-950/50"
                >
                  Dungeon
                </Link>
                <Link
                  to="/settings/ai"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 dark:text-slate-300 dark:hover:bg-purple-950/50"
                >
                  AI Gateway
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
                    <div className="mx-auto max-w-4xl px-6 py-20 text-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-purple-300 bg-purple-100 px-4 py-1 text-xs font-bold uppercase tracking-wider text-purple-800 dark:border-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                        <Flame className="h-3.5 w-3.5 text-purple-600 animate-bounce" />
                        The Leveling System Has Chosen You
                      </div>
                      <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white font-mono uppercase">
                        Skill Leveling
                      </h1>
                      <p className="mt-3 text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 via-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">
                        Rise from E-Rank Weakest to S-Rank Sovereign
                      </p>
                      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        Upload your technical resume and enter interview raids. High accuracy answers boost your Level (0 to 100), while poor responses trigger system penalties (-1/3 pts). Only the relentless level up.
                      </p>
                      <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <button
                          onClick={() => {
                            setIsRegister(false);
                            setShowLoginModal(true);
                          }}
                          className="rounded-xl bg-purple-600 px-6 py-3.5 font-mono text-sm font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.6)] hover:bg-purple-700 transition"
                        >
                          Awaken & Start Raid
                        </button>
                      </div>
                    </div>
                  )
                }
              />
              <Route path="/dashboard" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/sessions/new" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/history" element={currentUser ? <DashboardPage /> : <Navigate to="/" replace />} />
              <Route path="/settings/ai" element={currentUser ? <AISettingsPage /> : <Navigate to="/" replace />} />
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
            <div className="flex items-center gap-2 mb-2">
              <Sword className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isRegister ? 'Hunter Awakening' : 'Hunter Authorization'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
              {isRegister ? 'Register your hunter license to track ranks.' : 'Enter your credentials to enter the dungeon.'}
            </p>

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
