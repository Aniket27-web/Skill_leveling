import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { User, LogIn, LogOut } from 'lucide-react';
import { clearAISettings } from './api/aiSettings';

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

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

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
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        });
        if (!registerResponse.ok) {
          const err = await registerResponse.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'Could not create your account');
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
        throw new Error(err?.error?.message || 'Invalid email or password');
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
          {/* Global Header Navigation */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  AI
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-base tracking-tight">
                    Interview Coach
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full ml-2">
                    AI practice
                  </span>
                </div>
              </Link>

              {/* User Auth Controls */}
              <div className="flex items-center space-x-3">
                {authLoading ? (
                  <span className="text-xs text-slate-400">Checking auth...</span>
                ) : currentUser ? (
                  <div className="flex items-center space-x-3">
                    <Link to="/" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Dashboard</Link>
                    <Link to="/settings/ai" className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">AI settings</Link>
                    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs text-slate-700">
                      <User className="h-3.5 w-3.5 text-blue-600" />
                      <span className="font-medium">{currentUser.name}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsRegister(false); setShowLoginModal(true); }}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <LogIn className="h-3.5 w-3.5 mr-1.5" />
                    Sign in / Register
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 pb-16">
            <Suspense fallback={<div className="mx-auto max-w-7xl px-6 py-20 text-center text-sm text-slate-500">Loading your workspace…</div>}>
              <Routes>
                <Route path="/" element={currentUser ? <DashboardPage /> : <div className="mx-auto max-w-3xl px-6 py-24 text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">AI mock interview coach</p><h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">Practice with your experience. Improve with every answer.</h1><p className="mx-auto mt-4 max-w-xl text-slate-600">Upload your resume, work through tailored interview questions, and get clear feedback on what to strengthen.</p><button onClick={() => { setIsRegister(false); setShowLoginModal(true); }} className="mt-8 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Sign in or create an account</button></div>} />
                <Route path="/settings/ai" element={currentUser ? <AISettingsPage /> : <Navigate to="/" replace />} />
                <Route path="/interview/:id" element={<InterviewPage />} />
                <Route path="/summary/:id" element={<SummaryPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>

          {/* Login Modal */}
          {showLoginModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-1">{isRegister ? 'Create your account' : 'Welcome back'}</h3>
                <p className="text-xs text-slate-500 mb-4">{isRegister ? 'Create an account to save your sessions and progress.' : 'Sign in to continue your interview practice.'}</p>

                {loginError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-50 text-red-700 text-xs">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3">
                  {isRegister && <div><label className="mb-1 block text-xs font-medium text-slate-700">Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required /></div>}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      minLength={isRegister ? 8 : undefined}
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => { setIsRegister(!isRegister); setLoginError(null); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 hover:bg-slate-50 transition">{isRegister ? 'Sign in instead' : 'Create account'}</button>
                    <button
                      type="submit"
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                    >
                      {isRegister ? 'Register' : 'Sign In'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
