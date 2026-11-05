import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, FileText, Loader2, Plus, Trash2, UploadCloud, Shield, Flame, Zap } from 'lucide-react';
import { Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HunterStatusBar } from '../../components/HunterStatusBar';
import { MotivationalQuotesCard } from '../../components/MotivationalQuotesCard';
import logoImg from '../../assests/logo/Skill Leveling Growth Emblem.png';
import { loadUserPreferences } from '../settings/SettingsPage';

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
  const userPrefs = useMemo(() => loadUserPreferences(), []);
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState('');
  const [difficulty, setDifficulty] = useState<string>(userPrefs.defaultDifficulty || 'medium');
  const [numQuestions, setNumQuestions] = useState(userPrefs.defaultNumQuestions || 5);
  const [targetRole, setTargetRole] = useState('');
  const [timerSeconds, setTimerSeconds] = useState('');
  const [interviewMode, setInterviewMode] = useState<'text' | 'audio' | 'video'>(userPrefs.defaultMode || 'text');
  const [interviewCategory, setInterviewCategory] = useState('mixed');
  const [experienceLevel, setExperienceLevel] = useState('fresher');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [formError, setFormError] = useState('');

  const resumesQuery = useQuery({ queryKey: ['resumes'], queryFn: () => api<Resume[]>('/api/resumes') });
  const sessionsQuery = useQuery({ queryKey: ['sessions', 50, 0], queryFn: () => api<SessionList>('/api/sessions?limit=50&offset=0') });
  const progressQuery = useQuery({ queryKey: ['progress'], queryFn: () => api<ProgressItem[]>('/api/progress') });

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

  const handleStart = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!resumeId) {
      setFormError('Upload or select a resume before starting a practice session.');
      return;
    }
    createMutation.mutate();
  };

  const handleUpload = () => {
    if (!file) return;
    setFormError('');
    uploadMutation.mutate(file, { onError: (error) => setFormError(error.message) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Hunter Status Bar */}
      <HunterStatusBar />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-4">
          <img
            src={logoImg}
            alt="Skill Leveling Growth Emblem"
            className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_20px_rgba(147,51,234,0.5)] shrink-0 hidden sm:block hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] font-mono text-purple-700 bg-purple-100 dark:bg-purple-950/80 dark:border dark:border-purple-800 dark:text-purple-300 px-2.5 py-0.5 rounded-full">
                Dungeon Gate System
              </span>
              <span className="text-xs text-slate-500 dark:text-purple-400/80 font-mono">
                E-Rank to S-Rank Monarch
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Awaken Your Skills. Level Up.
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-purple-300/80">
              Upload your resume, select your dungeon rank, and conquer AI technical questions. Correct answers boost your Hunter level; inaccurate answers suffer a <span className="text-rose-600 dark:text-rose-400 font-semibold">1/3 penalty</span>.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
            <p className="text-xs font-mono text-slate-500 dark:text-purple-300/70">Dungeons Cleared</p>
            <p className="mt-1 text-xl font-black text-purple-700 dark:text-purple-300">{completed.length}</p>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-white px-4 py-3 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
            <p className="text-xs font-mono text-slate-500 dark:text-purple-300/70">Average Rating</p>
            <p className="mt-1 text-xl font-black text-purple-700 dark:text-purple-300">{average === null ? '—' : `${average.toFixed(1)}/10`}</p>
          </div>
        </div>
      </div>

      {/* Motivational Willpower Quotes Surge (Solo Leveling & Legendary Philosophers) */}
      <MotivationalQuotesCard />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Enter Interview Dungeon</h2>
              <p className="text-sm text-slate-500 dark:text-purple-300/70">AI generates questions grounded in your resume.</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-dashed border-purple-300 bg-purple-50/50 p-4 dark:border-purple-800/80 dark:bg-[#120a24]">
            <div className="flex items-start gap-3">
              <UploadCloud className="mt-0.5 h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">Hunter Resume Context</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-purple-300/60">PDF or DOCX, up to 5 MB</p>
                {resumesQuery.data?.length ? (
                  <select
                    value={resumeId}
                    onChange={(event) => setResumeId(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                  >
                    <option value="">Choose an uploaded resume</option>
                    {resumesQuery.data.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.filename}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-3 text-sm text-slate-600 dark:text-purple-300/70">No hunter resumes uploaded yet.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-semibold text-purple-700 hover:border-purple-400 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-300">
                    Choose file
                    <input
                      className="sr-only"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <span className="max-w-48 truncate text-xs text-slate-500 dark:text-purple-300/60">
                    {file?.name || 'No file selected'}
                  </span>
                  {file && (
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      className="rounded-xl bg-purple-700 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-60 dark:bg-purple-600 dark:hover:bg-purple-500"
                    >
                      {uploadMutation.isPending ? 'Uploading…' : 'Upload resume'}
                    </button>
                  )}
                  {uploadMutation.isSuccess && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resume ready</span>
                  )}
                </div>
                {selectedResume?.profile && (
                  <div className="mt-3 space-y-1 rounded-xl bg-white p-3 text-xs dark:bg-[#180e30] dark:border dark:border-purple-900/60">
                    <p className="font-semibold text-purple-900 dark:text-purple-300">Hunter Skill Arsenal</p>
                    <p className="text-slate-600 dark:text-purple-200/80">
                      {(selectedResume.profile.technologies || []).slice(0, 12).join(' · ') ||
                        (selectedResume.profile.skills || []).slice(0, 8).join(' · ') ||
                        'No structured skills found'}
                    </p>
                    <p className="text-slate-500 dark:text-purple-400/60 font-mono text-[11px]">
                      {(selectedResume.profile.projects || []).length} raids/projects · {(selectedResume.profile.experience || []).length} experiences
                    </p>
                  </div>
                )}
                {resumesQuery.data?.length ? (
                  <div className="mt-3 space-y-2">
                    {resumesQuery.data.map((resume) => (
                      <div
                        key={resume.id}
                        className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-purple-300"
                      >
                        <span className="truncate">{resume.filename}</span>
                        <div className="flex shrink-0 gap-1">
                          <label className="cursor-pointer rounded border border-purple-200 px-2 py-1 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950">
                            Replace
                            <input
                              type="file"
                              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="sr-only"
                              onChange={(event) => {
                                const replacement = event.target.files?.[0];
                                if (replacement) replaceResumeMutation.mutate({ id: resume.id, replacement });
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete ${resume.filename}?`)) deleteResumeMutation.mutate(resume.id);
                            }}
                            className="rounded border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <form onSubmit={handleStart} className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Dungeon Difficulty & Reward Multiplier
                </label>
                <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                  Correct adds Level · Subpar incurs 1/3 penalty
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'easy', label: 'Easy Dungeon', reward: '+6 pts', penalty: '-2.0 pts' },
                  { id: 'medium', label: 'Medium Raid', reward: '+10 pts', penalty: '-3.3 pts' },
                  { id: 'hard', label: 'Hard Gate', reward: '+15 pts', penalty: '-5.0 pts' },
                ].map(({ id: level, label, reward, penalty }) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`rounded-xl border p-2.5 text-center transition ${
                      difficulty === level
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950/80 dark:text-purple-200 dark:ring-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-purple-300 dark:border-purple-900/50 dark:text-purple-300/70 dark:hover:border-purple-700'
                    }`}
                  >
                    <span className="block text-xs font-bold capitalize">{label}</span>
                    <span className="mt-1 block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{reward}</span>
                    <span className="block text-[10px] font-mono text-rose-600 dark:text-rose-400">{penalty}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="question-count" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Number of questions
                </label>
                <select
                  id="question-count"
                  value={numQuestions}
                  onChange={(event) => setNumQuestions(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  {Array.from({ length: 13 }, (_, index) => index + 3).map((n) => (
                    <option key={n} value={n}>
                      {n} questions
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="timer" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Timer per question <span className="font-normal text-slate-400 dark:text-purple-400/60">(optional)</span>
                </label>
                <select
                  id="timer"
                  value={timerSeconds}
                  onChange={(event) => setTimerSeconds(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="">No timer</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="180">3 minutes</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="interview-category" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Category
                </label>
                <select
                  id="interview-category"
                  value={interviewCategory}
                  onChange={(event) => setInterviewCategory(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="mixed">Mixed</option>
                  <option value="technical">Technical</option>
                  <option value="hr">HR</option>
                  <option value="behavioral">Behavioral</option>
                </select>
              </div>
              <div>
                <label htmlFor="experience-level" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Experience level
                </label>
                <select
                  id="experience-level"
                  value={experienceLevel}
                  onChange={(event) => setExperienceLevel(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="fresher">Fresher</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-level</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <div>
                <label htmlFor="duration" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Dungeon length
                </label>
                <select
                  id="duration"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
                >
                  <option value="">No total limit</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Interview Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['text', 'Text chat', 'Type your answers'],
                  ['audio', 'Audio call', 'Speak and listen'],
                  ['video', 'Video call', 'Camera and voice'],
                ].map(([mode, title, description]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInterviewMode(mode as any)}
                    className={`rounded-xl border p-3 text-left transition ${
                      interviewMode === mode
                        ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950 dark:text-purple-200'
                        : 'border-slate-200 hover:border-purple-300 dark:border-purple-900/50 dark:text-purple-300/70'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
                    <span className="mt-1 block text-[11px] text-slate-500 dark:text-purple-400/60">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="target-role" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Target role <span className="font-normal text-slate-400 dark:text-purple-400/60">(optional)</span>
              </label>
              <input
                id="target-role"
                maxLength={100}
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100"
              />
            </div>

            {(formError || createMutation.error) && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {formError || createMutation.error?.message}
              </p>
            )}

            <button
              disabled={createMutation.isPending || uploadMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] transition hover:from-purple-600 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening Dungeon Gate…
                </>
              ) : (
                'Enter Practice Arena'
              )}
            </button>
          </form>
        </section>

        {/* Progress Chart */}
        <section className="rounded-3xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Hunter Progression Trend</h2>
              <p className="text-sm text-slate-500 dark:text-purple-300/70">Score trajectories across cleared dungeons.</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`${Number(value ?? 0).toFixed(1)} / 10`, 'Score']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="overall_score"
                    stroke="#9333ea"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#9333ea' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center rounded-2xl bg-purple-50/50 p-6 text-center dark:bg-[#120a24]">
              <BarChart3 className="h-8 w-8 text-purple-300 dark:text-purple-600" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-purple-200">Your trend starts here</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-purple-400/60">Complete a session to record your rating.</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-950/60 dark:border dark:border-purple-900/50">
              <p className="text-xs font-mono text-purple-700 dark:text-purple-300">Dungeons Cleared</p>
              <p className="mt-1 text-lg font-black text-purple-950 dark:text-purple-100">{completed.length}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/60 dark:border dark:border-indigo-900/50">
              <p className="text-xs font-mono text-indigo-700 dark:text-indigo-300">Average Rating</p>
              <p className="mt-1 text-lg font-black text-indigo-950 dark:text-indigo-100">
                {average === null ? '—' : `${average.toFixed(1)} / 10`}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Recent Sessions */}
      <section className="overflow-hidden rounded-3xl border border-purple-200 bg-white shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
        <div className="flex items-center justify-between border-b border-purple-100 px-6 py-5 dark:border-purple-900/50">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Dungeon Raid Records</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-purple-400/70">Review battle logs or re-enter active dungeons.</p>
          </div>
          <FileText className="h-5 w-5 text-purple-400" />
        </div>
        {sessionsQuery.isLoading ? (
          <p className="p-6 text-sm text-slate-500 dark:text-purple-300/70">Loading battle logs…</p>
        ) : sessionsQuery.error ? (
          <p role="alert" className="p-6 text-sm text-rose-700 dark:text-rose-400">
            {(sessionsQuery.error as Error).message}
          </p>
        ) : sessionsQuery.data?.items.length ? (
          <div className="divide-y divide-purple-100 dark:divide-purple-900/40">
            {sessionsQuery.data.items.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800 dark:text-purple-100">
                    {session.target_role || 'General Interview'}{' '}
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                      {session.difficulty}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-purple-400/70 font-mono">
                    {dateLabel(session.created_at)} · {session.num_questions} questions ·{' '}
                    {session.status === 'completed'
                      ? `Score ${session.overall_score?.toFixed(1) ?? '—'}/10`
                      : 'In progress'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={session.status === 'completed' ? `/summary/${session.id}` : `/interview/${session.id}`}
                    className="rounded-lg bg-purple-100 px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-200 dark:bg-purple-900/60 dark:text-purple-200 dark:hover:bg-purple-800"
                  >
                    {session.status === 'completed' ? 'View debrief' : 'Re-enter'}
                  </Link>
                  <button
                    aria-label={`Delete session ${session.id}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Delete this battle log and feedback?')) deleteMutation.mutate(session.id);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-purple-400/60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-purple-200">No battle records yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-purple-400/60">
              Awaken your hunter journey by entering your first dungeon above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
