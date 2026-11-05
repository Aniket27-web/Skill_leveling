import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Cpu,
  Key,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  Trash2,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Volume2,
  Sparkles,
  Moon,
  Sun,
  Sliders,
  Globe,
  Server,
  Zap,
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

type SettingsInfo = {
  configured: boolean;
  provider: string | null;
  model: string | null;
  base_url: string | null;
  api_key_configured: boolean;
};

type TestResult = { ok: boolean; message: string; provider?: string; model?: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

const PROVIDER_OPTIONS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIzaSy...',
    keyHelp: 'Get your key from Google AI Studio (aistudio.google.com)',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    placeholder: 'sk-proj-...',
    keyHelp: 'Get your key from OpenAI Platform (platform.openai.com)',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...',
    keyHelp: 'Get your key from Anthropic Console (console.anthropic.com)',
  },
  {
    id: 'openai_compatible',
    name: 'OpenAI Compatible (Groq / Ollama / DeepSeek / Mistral)',
    models: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'mixtral-8x7b-32768'],
    placeholder: 'gsk_... or custom key',
    keyHelp: 'Supports Groq (https://api.groq.com/openai/v1), OpenRouter, or Local Ollama',
  },
];

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
  const queryClient = useQueryClient();
  const { theme, toggleTheme, isDark } = useTheme();

  // Active section tab: 'ai' | 'hunter' | 'interview' | 'appearance'
  const [activeTab, setActiveTab] = useState<'ai' | 'hunter' | 'interview' | 'appearance'>('ai');

  // AI Configuration State
  const [provider, setProvider] = useState<string>('gemini');
  const [model, setModel] = useState<string>('gemini-2.0-flash');
  const [customModel, setCustomModel] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hunter Profile State
  const [hunterProfile, setHunterProfile] = useState<HunterProfile>(loadHunterProfile);

  // User Preferences State
  const [preferences, setPreferences] = useState<UserPreferences>(loadUserPreferences);
  const [prefsSaved, setPrefsSaved] = useState<boolean>(false);

  // Query server AI settings
  const settingsQuery = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api<SettingsInfo>('/api/ai-settings'),
  });

  // Query authenticated hunter info
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.ok ? res.json() : null;
    },
  });

  // Initialize fields once query returns
  useEffect(() => {
    if (settingsQuery.data) {
      if (settingsQuery.data.provider) setProvider(settingsQuery.data.provider);
      if (settingsQuery.data.model) {
        setModel(settingsQuery.data.model);
        const known = PROVIDER_OPTIONS.find((p) => p.id === settingsQuery.data.provider)?.models || [];
        if (!known.includes(settingsQuery.data.model)) {
          setCustomModel(settingsQuery.data.model);
        }
      }
      if (settingsQuery.data.base_url) setBaseUrl(settingsQuery.data.base_url);
    }
  }, [settingsQuery.data]);

  // Mutation: Save AI Settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      const effectiveModel = customModel.trim() || model.trim();
      const payload: Record<string, any> = {
        provider,
        model: effectiveModel,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      if (provider === 'openai_compatible' && baseUrl.trim()) {
        payload.base_url = baseUrl.trim();
      }
      return api<SettingsInfo>('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      setApiKey('');
      setStatusMessage({
        type: 'success',
        text: `Successfully awakened AI provider: ${data.provider} (${data.model})!`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ type: 'error', text: err.message });
    },
  });

  // Mutation: Test Live Key or Saved Key
  const testMutation = useMutation({
    mutationFn: async () => {
      const effectiveModel = customModel.trim() || model.trim();
      if (apiKey.trim()) {
        // Test with live input key
        return api<TestResult>('/api/ai-settings/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model: effectiveModel,
            api_key: apiKey.trim(),
            base_url: provider === 'openai_compatible' ? baseUrl.trim() || null : null,
          }),
        });
      } else {
        // Test currently saved configuration
        return api<TestResult>('/api/ai-settings/test-saved', {
          method: 'POST',
        });
      }
    },
    onSuccess: (data) => {
      setStatusMessage({
        type: 'success',
        text: `Connection verified! ${data.message || 'AI provider responded successfully.'}`,
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ type: 'error', text: err.message });
    },
  });

  // Mutation: Reset / Delete AI Settings (fallback to server default)
  const resetMutation = useMutation({
    mutationFn: () => api<void>('/api/ai-settings', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      setApiKey('');
      setCustomModel('');
      setBaseUrl('');
      setStatusMessage({
        type: 'success',
        text: 'Custom AI provider reset. The engine has reverted to server environment defaults.',
      });
    },
    onError: (err: Error) => {
      setStatusMessage({ type: 'error', text: err.message });
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

  const currentProviderOpt = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];
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
            Configure your custom AI LLM providers, manage Hunter credentials, and customize your interview raid defaults.
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap gap-2 border-b border-purple-100 pb-3 dark:border-purple-900/50">
        {[
          { id: 'ai', label: 'AI Engine & API Keys', icon: Cpu },
          { id: 'hunter', label: 'Hunter License', icon: User },
          { id: 'interview', label: 'Arena Preferences', icon: Sliders },
          { id: 'appearance', label: 'Visual Theme', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setStatusMessage(null);
              }}
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

      {/* Status Feedback Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-2xl p-4 text-xs sm:text-sm shadow-sm transition-all ${
            statusMessage.type === 'success'
              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{statusMessage.type === 'success' ? 'Operation Succeeded' : 'Error Occurred'}</p>
            <p className="mt-0.5 leading-relaxed">{statusMessage.text}</p>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold uppercase opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: AI Engine & API Keys */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Active Provider Status Card */}
          <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-100 dark:border-purple-900/40">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                    Active AI Model & Status
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-purple-300/70">
                    Powers dynamic question generation, voice questions, and instant 0–10 answer evaluations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settingsQuery.data?.configured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Custom Key Active ({settingsQuery.data.provider})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    Server Default Engine
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-purple-50/60 p-4 border border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-900/40">
                <p className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-purple-400">Current Provider</p>
                <p className="mt-1 text-sm font-bold text-purple-900 dark:text-purple-200 capitalize">
                  {settingsQuery.data?.provider || 'Server Default (Gemini/Local)'}
                </p>
              </div>
              <div className="rounded-2xl bg-purple-50/60 p-4 border border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-900/40">
                <p className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-purple-400">Active Model</p>
                <p className="mt-1 text-sm font-bold text-purple-900 dark:text-purple-200 font-mono">
                  {settingsQuery.data?.model || 'gemini-2.0-flash'}
                </p>
              </div>
              <div className="rounded-2xl bg-purple-50/60 p-4 border border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-900/40">
                <p className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-purple-400">API Key Encryption</p>
                <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Shield className="h-4 w-4" /> AES-256 Encrypted
                </p>
              </div>
            </div>
          </section>

          {/* Configure Any LLM Form */}
          <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  Awaken Any Custom LLM Provider
                </h2>
                <p className="text-xs text-slate-500 dark:text-purple-300/70">
                  Supply your personal API key from Gemini, OpenAI, Anthropic Claude, Groq, or local Ollama.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Provider Selection */}
              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  Select AI Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROVIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setProvider(opt.id);
                        setModel(opt.models[0]);
                        setCustomModel('');
                      }}
                      className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                        provider === opt.id
                          ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950/70 dark:text-purple-100 dark:ring-purple-700'
                          : 'border-slate-200 bg-white hover:border-purple-300 dark:border-purple-900/40 dark:bg-[#120726] dark:text-slate-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <span className="text-sm font-bold">{opt.name}</span>
                      <span className="mt-1 text-[11px] text-slate-500 dark:text-purple-400">
                        Default: <code className="font-mono">{opt.models[0]}</code>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                    Recommended Models
                  </label>
                  <select
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setCustomModel('');
                    }}
                    className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                  >
                    {currentProviderOpt.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                    Or Custom Model Name
                  </label>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash or deepseek-r1"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100 font-mono"
                  />
                </div>
              </div>

              {/* API Key Input */}
              <div>
                <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  {currentProviderOpt.name} API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      settingsQuery.data?.api_key_configured && !apiKey
                        ? '•••••••••••••••••••••••••••••••• (Key Configured · Enter new key to update)'
                        : currentProviderOpt.placeholder
                    }
                    className="w-full rounded-xl border border-purple-200 bg-white pl-4 pr-11 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-purple-300"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-purple-400/80 font-mono">
                  {currentProviderOpt.keyHelp}
                </p>
              </div>

              {/* Custom Base URL (for OpenAI Compatible / Groq / Ollama) */}
              {provider === 'openai_compatible' && (
                <div>
                  <label className="mb-2 block text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-purple-300">
                    Endpoint Base URL (Required for Custom / Groq / Ollama)
                  </label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.groq.com/openai/v1 or http://localhost:11434/v1"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100 font-mono"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-purple-100 dark:border-purple-900/40">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || (!apiKey.trim() && !settingsQuery.data?.api_key_configured)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 px-5 py-2.5 text-xs font-bold font-mono text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] transition hover:from-purple-600 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save & Awaken Provider
                </button>

                <button
                  type="button"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || (!apiKey.trim() && !settingsQuery.data?.api_key_configured)}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-300 bg-purple-50 px-4 py-2.5 text-xs font-bold font-mono text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  Test Connection
                </button>

                {settingsQuery.data?.configured && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Revert to server default AI configuration?')) {
                        resetMutation.mutate();
                      }
                    }}
                    disabled={resetMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold font-mono text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/60 transition ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Reset to Default
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Hunter License & Profile */}
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

      {/* TAB 3: Arena Preferences */}
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

      {/* TAB 4: Appearance & Theme */}
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

