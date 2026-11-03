import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, FileText, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Resume = { id: string; filename: string; created_at: string; char_count?: number; preview?: string; profile?: { skills: string[]; technologies: string[]; projects: string[]; education: string[]; experience: string[] } | null };
type SessionItem = {
  id: string; created_at: string; difficulty: string; target_role: string | null;
  num_questions: number; overall_score: number | null; status: 'in_progress' | 'completed';
};
type SessionList = { items: SessionItem[]; total: number };
type ProgressItem = { session_id: string; date: string; overall_score: number; difficulty: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [targetRole, setTargetRole] = useState('');
  const [timerSeconds, setTimerSeconds] = useState('');
  const [interviewMode, setInterviewMode] = useState<'text' | 'audio' | 'video'>('text');
  const [interviewCategory, setInterviewCategory] = useState('mixed');
  const [experienceLevel, setExperienceLevel] = useState('fresher');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [noKeyNotice, setNoKeyNotice] = useState(false);
  const [formError, setFormError] = useState('');

  const resumesQuery = useQuery({ queryKey: ['resumes'], queryFn: () => api<Resume[]>('/api/resumes') });
  const sessionsQuery = useQuery({ queryKey: ['sessions', 50, 0], queryFn: () => api<SessionList>('/api/sessions?limit=50&offset=0') });
  const progressQuery = useQuery({ queryKey: ['progress'], queryFn: () => api<ProgressItem[]>('/api/progress') });
  const aiSettingsQuery = useQuery({ queryKey: ['ai-settings'], queryFn: () => api<{ configured: boolean; provider?: string; model?: string }>('/api/ai-settings') });

  const uploadMutation = useMutation({
    mutationFn: async (resumeFile: File) => {
      const data = new FormData();
      data.append('file', resumeFile);
      return api<Resume>('/api/resumes', { method: 'POST', body: data });
    },
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setResumeId(resume.id);
      setFile(null);
      setFormError('');
    },
  });
  const replaceResumeMutation = useMutation({
    mutationFn: async ({ id, replacement }: { id: string; replacement: File }) => {
      const data = new FormData(); data.append('file', replacement);
      return api<Resume>(`/api/resumes/${id}`, { method: 'PUT', body: data });
    },
    onSuccess: (resume) => { queryClient.invalidateQueries({ queryKey: ['resumes'] }); setResumeId(resume.id); setFormError(''); },
    onError: (error) => setFormError(error.message),
  });
  const deleteResumeMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => { queryClient.invalidateQueries({ queryKey: ['resumes'] }); if (resumeId === id) setResumeId(''); },
  });

  const createMutation = useMutation({
    mutationFn: () => api<{ id: string }>('/api/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_id: resumeId, difficulty, num_questions: numQuestions,
        target_role: targetRole.trim() || null,
        timer_seconds: timerSeconds ? Number(timerSeconds) : null,
        interview_mode: interviewMode,
        interview_category: interviewCategory,
        experience_level: experienceLevel,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      }),
    }),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate(`/interview/${id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  const chartData = useMemo(() => (progressQuery.data || []).map((point, index) => ({
    ...point, name: `Session ${index + 1}`, dateLabel: dateLabel(point.date),
  })), [progressQuery.data]);
  const completed = (sessionsQuery.data?.items || []).filter((session) => session.status === 'completed');
  const selectedResume = resumesQuery.data?.find((resume) => resume.id === resumeId);
  const average = completed.length
    ? completed.reduce((sum, session) => sum + (session.overall_score || 0), 0) / completed.length
    : null;

  const beginSession = () => {
    setNoKeyNotice(false);
    createMutation.mutate();
  };

  const handleStart = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!resumeId) {
      setFormError('Upload or select a resume before starting a practice session.');
      return;
    }
    if (!aiSettingsQuery.data?.configured) {
      setNoKeyNotice(true);
      return;
    }
    beginSession();
  };

  const handleUpload = () => {
    if (!file) return;
    setFormError('');
    uploadMutation.mutate(file, { onError: (error) => setFormError(error.message) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Your practice space</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Build interview confidence, one answer at a time.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Upload your resume, choose a challenge, and get specific feedback grounded in your experience.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Sessions completed</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{completed.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Average score</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{average === null ? '—' : `${average.toFixed(1)}/10`}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Plus className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-bold text-slate-900">Start a mock interview</h2><p className="text-sm text-slate-500">Questions are tailored to your resume.</p></div>
          </div>

          <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <UploadCloud className="mt-0.5 h-5 w-5 text-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">Resume</p>
                <p className="mt-0.5 text-xs text-slate-500">PDF or DOCX, up to 5 MB</p>
                {resumesQuery.data?.length ? (
                  <select value={resumeId} onChange={(event) => setResumeId(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
                    <option value="">Choose an uploaded resume</option>
                    {resumesQuery.data.map((resume) => <option key={resume.id} value={resume.id}>{resume.filename}</option>)}
                  </select>
                ) : <p className="mt-3 text-sm text-slate-600">No resumes uploaded yet.</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300">
                    Choose file<input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </label>
                  <span className="max-w-48 truncate text-xs text-slate-500">{file?.name || 'No file selected'}</span>
                  {file && <button type="button" onClick={handleUpload} disabled={uploadMutation.isPending} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{uploadMutation.isPending ? 'Uploading…' : 'Upload resume'}</button>}
                  {uploadMutation.isSuccess && <span className="text-xs font-medium text-emerald-700">Resume ready</span>}
                </div>
                {selectedResume?.profile && <div className="mt-3 space-y-1 rounded-xl bg-white p-3 text-xs"><p className="font-semibold text-slate-700">Extracted profile</p><p className="text-slate-500">{selectedResume.profile.technologies.slice(0, 12).join(' · ') || selectedResume.profile.skills.slice(0, 8).join(' · ') || 'No structured skills found'}</p><p className="text-slate-500">{selectedResume.profile.projects.length} projects · {selectedResume.profile.experience.length} experience entries · {selectedResume.profile.education.length} education entries</p></div>}
                {resumesQuery.data?.length ? <div className="mt-3 space-y-2">{resumesQuery.data.map((resume) => <div key={resume.id} className="flex items-center justify-between gap-2 text-xs text-slate-600"><span className="truncate">{resume.filename}</span><div className="flex shrink-0 gap-1"><label className="cursor-pointer rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">Replace<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => { const replacement = event.target.files?.[0]; if (replacement) replaceResumeMutation.mutate({ id: resume.id, replacement }); event.target.value = ''; }} /></label><button type="button" onClick={() => { if (window.confirm(`Delete ${resume.filename}?`)) deleteResumeMutation.mutate(resume.id); }} className="rounded border border-slate-200 px-2 py-1 text-rose-700 hover:bg-rose-50">Delete</button></div></div>)}</div> : null}
              </div>
            </div>
          </div>

          <form onSubmit={handleStart} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map((level) => <button key={level} type="button" onClick={() => setDifficulty(level)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition ${difficulty === level ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{level}</button>)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="question-count" className="mb-2 block text-sm font-semibold text-slate-800">Number of questions</label><select id="question-count" value={numQuestions} onChange={(event) => setNumQuestions(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">{Array.from({ length: 13 }, (_, index) => index + 3).map((n) => <option key={n} value={n}>{n} questions</option>)}</select></div>
              <div><label htmlFor="timer" className="mb-2 block text-sm font-semibold text-slate-800">Timer per question <span className="font-normal text-slate-400">(optional)</span></label><select id="timer" value={timerSeconds} onChange={(event) => setTimerSeconds(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"><option value="">No timer</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor="interview-category" className="mb-2 block text-sm font-semibold text-slate-800">Interview category</label><select id="interview-category" value={interviewCategory} onChange={(event) => setInterviewCategory(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="mixed">Mixed</option><option value="technical">Technical</option><option value="hr">HR</option><option value="behavioral">Behavioral</option></select></div>
              <div><label htmlFor="experience-level" className="mb-2 block text-sm font-semibold text-slate-800">Experience level</label><select id="experience-level" value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="fresher">Fresher</option><option value="junior">Junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="lead">Lead</option></select></div>
              <div><label htmlFor="duration" className="mb-2 block text-sm font-semibold text-slate-800">Interview length</label><select id="duration" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">No total limit</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Interview format</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['text', 'Text chat', 'Type your answers'],
                  ['audio', 'Audio call', 'Speak and listen'],
                  ['video', 'Video call', 'Camera and voice'],
                ] as const).map(([mode, title, description]) => <button key={mode} type="button" onClick={() => setInterviewMode(mode)} className={`rounded-xl border p-3 text-left transition ${interviewMode === mode ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="mt-1 block text-[11px] text-slate-500">{description}</span></button>)}
              </div>
            </div>
            <div><label htmlFor="target-role" className="mb-2 block text-sm font-semibold text-slate-800">Target role <span className="font-normal text-slate-400">(optional)</span></label><input id="target-role" maxLength={100} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Frontend Engineer" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
            <div className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-800">AI provider</p>{aiSettingsQuery.data?.configured ? <p className="mt-1 text-xs text-emerald-700">Using your saved {aiSettingsQuery.data.provider} model ({aiSettingsQuery.data.model}).</p> : <p className="mt-1 text-xs text-slate-500">No personal key is saved. You can configure one in AI settings or continue with the server provider.</p>}<Link to="/settings/ai" className="mt-3 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Configure AI provider</Link></div>
            {noKeyNotice && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">No personal API key configured</p><p className="mt-1 text-xs text-amber-800">If you continue, the interview uses the server-configured provider. If none is configured, it may use demo responses or AI feedback may be unavailable.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={beginSession} className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">Continue without a key</button><Link to="/settings/ai" className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Set up a key</Link></div></div>}
            {(formError || createMutation.error) && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{formError || createMutation.error?.message}</p>}
            <button disabled={createMutation.isPending || uploadMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your interview…</> : 'Start practice session'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><BarChart3 className="h-5 w-5" /></div><div><h2 className="text-lg font-bold text-slate-900">Your progress</h2><p className="text-sm text-slate-500">A score trend across completed sessions.</p></div></div>
          {chartData.length > 0 ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number) => [`${value.toFixed(1)} / 10`, 'Score']} labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''} /><Line type="monotone" dataKey="overall_score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div> : <div className="flex h-56 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center"><BarChart3 className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Your trend starts here</p><p className="mt-1 text-xs text-slate-500">Complete a session to see your score history.</p></div>}
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-700">Completed sessions</p><p className="mt-1 text-lg font-bold text-blue-950">{completed.length}</p></div><div className="rounded-xl bg-violet-50 p-3"><p className="text-xs text-violet-700">Average score</p><p className="mt-1 text-lg font-bold text-violet-950">{average === null ? '—' : `${average.toFixed(1)} / 10`}</p></div></div>
        </section>
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="font-bold text-slate-900">Recent sessions</h2><p className="mt-1 text-xs text-slate-500">Review feedback or continue an interview in progress.</p></div><FileText className="h-5 w-5 text-slate-400" /></div>
        {sessionsQuery.isLoading ? <p className="p-6 text-sm text-slate-500">Loading your sessions…</p> : sessionsQuery.error ? <p role="alert" className="p-6 text-sm text-rose-700">{(sessionsQuery.error as Error).message}</p> : sessionsQuery.data?.items.length ? <div className="divide-y divide-slate-100">{sessionsQuery.data.items.map((session) => <div key={session.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{session.target_role || 'General interview'} <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{session.difficulty}</span></p><p className="mt-1 text-xs text-slate-500">{dateLabel(session.created_at)} · {session.num_questions} questions · {session.status === 'completed' ? `Score ${session.overall_score?.toFixed(1) ?? '—'}/10` : 'In progress'}</p></div><div className="flex items-center gap-2"><Link to={session.status === 'completed' ? `/summary/${session.id}` : `/interview/${session.id}`} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">{session.status === 'completed' ? 'View feedback' : 'Continue'}</Link><button aria-label={`Delete session ${session.id}`} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm('Delete this session and its feedback?')) deleteMutation.mutate(session.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <div className="p-8 text-center"><p className="text-sm font-semibold text-slate-700">No practice sessions yet</p><p className="mt-1 text-xs text-slate-500">Set up your first interview above to get started.</p></div>}
      </section>
    </div>
  );
};
