import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Server, Wifi, Cpu } from 'lucide-react';

type SettingsInfo = { configured: boolean; provider: string; model: string | null };
type TestResult = { message: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  return response.json();
}

export const AISettingsPage: React.FC = () => {
  const settingsQuery = useQuery({ queryKey: ['ai-settings'], queryFn: () => api<SettingsInfo>('/api/ai-settings') });
  const testMutation = useMutation({
    mutationFn: () => api<TestResult>('/api/ai-settings/test', { method: 'POST' }),
  });
  const settings = settingsQuery.data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border dark:border-purple-800 px-2.5 py-0.5 rounded-full inline-block">
          System Core Configuration
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          AI Awakening Engine
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-purple-300/80">
          The AI provider generates interview challenges and evaluates hunter answers across difficulty tiers.
        </p>
      </header>

      <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a] sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Server-Managed AI Model</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-purple-400/70">
              The API key is securely held by the FastAPI backend in <code>backend/.env</code> and never exposed to the browser.
            </p>
          </div>
        </div>

        {settingsQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-purple-400/70">Loading provider status…</p>
        ) : settingsQuery.error ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            {(settingsQuery.error as Error).message}
          </p>
        ) : (
          <>
            <div
              className={`rounded-2xl border p-4 ${
                settings?.configured
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
              }`}
            >
              <div
                className={`flex items-center gap-2 text-sm font-semibold ${
                  settings?.configured
                    ? 'text-emerald-900 dark:text-emerald-300'
                    : 'text-amber-900 dark:text-amber-300'
                }`}
              >
                {settings?.configured ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {settings?.configured
                  ? `Awakened: ${settings.provider} · ${settings.model}`
                  : 'Server AI provider is not configured'}
              </div>
              {!settings?.configured && (
                <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300/80">
                  Set <code>LLM_PROVIDER</code> and <code>LLM_API_KEY</code> in <code>backend/.env</code>, then restart the backend. Supported providers: Gemini, OpenAI, Groq, Ollama, Claude, DeepSeek, or Fake.
                </p>
              )}
            </div>

            {testMutation.data && (
              <div
                role="status"
                className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm text-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {testMutation.data.message}
              </div>
            )}
            {testMutation.error && (
              <div
                role="alert"
                className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3 text-sm text-rose-700 dark:text-rose-300"
              >
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                {(testMutation.error as Error).message}
              </div>
            )}

            <div className="mt-6 border-t border-purple-100 dark:border-purple-900/50 pt-5">
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={!settings?.configured || testMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Test Engine Connection
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
};
