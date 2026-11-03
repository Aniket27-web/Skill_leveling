import React, { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, Wifi } from 'lucide-react';

type Provider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';
type SettingsInfo = { configured: boolean; provider: Provider | null; model: string | null; base_url: string | null; api_key_configured: boolean };
type SettingsForm = { provider: Provider; model: string; base_url: string; api_key: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

const defaults: Record<Provider, string> = {
  openai: 'gpt-5.5', anthropic: 'claude-sonnet-5', gemini: 'gemini-3.8-flash', openai_compatible: 'gpt-5.5',
};

export const AISettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>({ provider: 'openai', model: defaults.openai, base_url: '', api_key: '' });
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const settingsQuery = useQuery({ queryKey: ['ai-settings'], queryFn: () => api<SettingsInfo>('/api/ai-settings') });

  useEffect(() => {
    const saved = settingsQuery.data;
    if (!saved?.configured || !saved.provider) return;
    setForm((current) => ({ ...current, provider: saved.provider!, model: saved.model || defaults[saved.provider!], base_url: saved.base_url || '', api_key: '' }));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: SettingsForm) => api<SettingsInfo>('/api/ai-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, api_key: payload.api_key || null, base_url: payload.base_url || null }),
    }),
    onSuccess: (saved) => {
      setForm((current) => ({ ...current, api_key: '' }));
      queryClient.setQueryData(['ai-settings'], saved);
      setStatusMessage({ ok: true, text: 'Provider settings saved securely.' });
    },
    onError: (error) => setStatusMessage({ ok: false, text: error.message }),
  });
  const testMutation = useMutation({
    mutationFn: () => api<{ message: string }>('/api/ai-settings/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: form.provider, model: form.model, api_key: form.api_key, base_url: form.base_url || null }),
    }),
    onSuccess: (result) => setStatusMessage({ ok: true, text: result.message }),
    onError: (error) => setStatusMessage({ ok: false, text: error.message }),
  });
  const testSavedMutation = useMutation({
    mutationFn: () => api<{ message: string }>('/api/ai-settings/test-saved', { method: 'POST' }),
    onSuccess: (result) => setStatusMessage({ ok: true, text: result.message }),
    onError: (error) => setStatusMessage({ ok: false, text: error.message }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => api<void>('/api/ai-settings', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueryData(['ai-settings'], { configured: false, provider: null, model: null, base_url: null, api_key_configured: false });
      setForm({ provider: 'openai', model: defaults.openai, base_url: '', api_key: '' });
      setStatusMessage({ ok: true, text: 'Saved provider credentials removed.' });
    },
    onError: (error) => setStatusMessage({ ok: false, text: error.message }),
  });

  const handleSubmit = (event: FormEvent) => { event.preventDefault(); setStatusMessage(null); saveMutation.mutate(form); };
  const handleProviderChange = (provider: Provider) => setForm((current) => ({ ...current, provider, model: defaults[provider], base_url: provider === 'openai_compatible' ? current.base_url : '' }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Workspace settings</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">AI provider</h1><p className="mt-2 text-sm text-slate-600">Configure the model used to create questions, evaluate answers, and summarize interviews.</p></header>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-900">Encrypted provider credentials</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Your API key is encrypted before storage and is only used for your account's AI requests. It is never returned to the browser or written to logs. Use HTTPS in production.</p></div></div>
        {settingsQuery.isLoading ? <p className="text-sm text-slate-500">Loading settings…</p> : settingsQuery.error ? <p role="alert" className="text-sm text-rose-700">{(settingsQuery.error as Error).message}</p> : <>
          {settingsQuery.data?.configured && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" />{settingsQuery.data.provider} · {settingsQuery.data.model}<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase">Key saved</span></div><button type="button" onClick={() => testSavedMutation.mutate()} disabled={testSavedMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-60"><Wifi className="h-3.5 w-3.5" />{testSavedMutation.isPending ? 'Testing…' : 'Test saved connection'}</button></div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div><label htmlFor="provider" className="mb-2 block text-sm font-semibold text-slate-800">Provider</label><select id="provider" value={form.provider} onChange={(event) => handleProviderChange(event.target.value as Provider)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"><option value="openai">OpenAI API</option><option value="anthropic">Anthropic Claude</option><option value="gemini">Google Gemini</option><option value="openai_compatible">Custom OpenAI-compatible API</option></select></div>
            <div><label htmlFor="model" className="mb-2 block text-sm font-semibold text-slate-800">Model ID</label><input id="model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required maxLength={120} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" /><p className="mt-1 text-xs text-slate-500">Gemini 3.8 Flash may fall back to Gemini 3.6 Flash, then Gemini 3.5 Flash-Lite, during capacity errors or model-specific daily quota limits. Fallback requests may count toward provider usage.</p></div>
            {form.provider === 'openai_compatible' && <div><label htmlFor="endpoint" className="mb-2 block text-sm font-semibold text-slate-800">API base URL</label><input id="endpoint" type="url" value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} placeholder="https://api.example.com/v1" required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" /><p className="mt-1 text-xs text-slate-500">Must expose a compatible `/chat/completions` endpoint. HTTPS is required outside local development.</p></div>}
            <div><label htmlFor="api-key" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><KeyRound className="h-4 w-4 text-slate-500" />API key</label><input id="api-key" type="password" autoComplete="new-password" value={form.api_key} onChange={(event) => setForm({ ...form, api_key: event.target.value })} placeholder={settingsQuery.data?.api_key_configured ? 'Leave blank to keep the saved key' : 'Paste provider API key'} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" /></div>
            {statusMessage && <div role={statusMessage.ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl p-3 text-sm ${statusMessage.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{statusMessage.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}{statusMessage.text}</div>}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              <button type="button" onClick={() => testMutation.mutate()} disabled={!form.api_key || testMutation.isPending || !form.model.trim()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}Test before saving</button>
              <button type="submit" disabled={saveMutation.isPending || !form.model.trim()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save settings</button>
              {settingsQuery.data?.configured && <button type="button" onClick={() => { if (window.confirm('Remove your saved provider key?')) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" />Remove key</button>}
            </div>
          </form>
        </>}
      </section>
    </main>
  );
};
