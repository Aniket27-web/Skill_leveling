import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  Zap,
  Award,
  Trophy,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare,
  PhoneCall,
  Video,
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HunterStatusBar } from '../../components/HunterStatusBar';
import { MotivationalQuotesCard } from '../../components/MotivationalQuotesCard';
import logoImg from '../../assests/logo/Skill Leveling Growth Emblem.png';
import { loadUserPreferences } from '../settings/SettingsPage';

type Resume = {
  id: string;
  filename: string;
  created_at: string;
  char_count?: number;
  preview?: string;
  profile?: {
    skills: string[];
    technologies: string[];
    projects: string[];
    education: string[];
    experience: string[];
  } | null;
};

type SessionItem = {
  id: string;
  created_at: string;
  difficulty: string;
  target_role: string | null;
  num_questions: number;
  overall_score: number | null;
  status: 'in_progress' | 'completed';
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

const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-purple-200 bg-white p-3 shadow-lg dark:border-purple-800 dark:bg-[#140b27]">
        <p className="text-xs font-bold text-slate-900 dark:text-purple-100">
          {payload[0]?.payload?.name || label}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-purple-300/70 font-mono">
          {payload[0]?.payload?.dateLabel}
        </p>
        <p className="mt-1 text-sm font-extrabold text-purple-600 dark:text-purple-400">
          Score: {Number(payload[0]?.value ?? 0).toFixed(1)} / 10
        </p>
      </div>
    );
  }
  return null;
};

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
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 50, 0],
    queryFn: () => api<SessionList>('/api/sessions?limit=50&offset=0'),
  });
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
      const data = new FormData();
      data.append('file', replacement);
      return api<Resume>(`/api/resumes/${id}`, { method: 'PUT', body: data });
    },
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setResumeId(resume.id);
      setFormError('');
    },
    onError: (error) => setFormError(error.message),
  });

  const deleteResumeMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      if (resumeId === id) setResumeId('');
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: resumeId,
          difficulty,
          num_questions: numQuestions,
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

  const chartData = useMemo(
    () =>
      (progressQuery.data || []).map((point, index) => ({
        ...point,
        name: `Raid ${index + 1}`,
        dateLabel: dateLabel(point.date),
      })),
    [progressQuery.data]
  );

  const completed = (sessionsQuery.data?.items || []).filter((session) => session.status === 'completed');
  const selectedResume = resumesQuery.data?.find((resume) => resume.id === resumeId);
  const average = completed.length
    ? completed.reduce((sum, session) => sum + (session.overall_score || 0), 0) / completed.length
    : null;
  const bestScore = completed.length
    ? Math.max(...completed.map((s) => s.overall_score || 0))
    : null;

  const handleStart = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!resumeId) {
      setFormError('Upload or select a resume before entering an interview dungeon.');
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in font-sans">
      {/* 1. Hunter Status Bar */}
      <HunterStatusBar />

      {/* 2. Command Hero & KPI Metric Cards */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <img
            src={logoImg}
            alt="Skill Leveling Emblem"
            className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_20px_rgba(147,51,234,0.5)] shrink-0 hidden sm:block hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] font-mono text-purple-700 bg-purple-100 dark:bg-purple-950/80 dark:border dark:border-purple-800 dark:text-purple-300 px-2.5 py-0.5 rounded-full">
                Dungeon Gate Command
              </span>
              <span className="text-xs text-slate-500 dark:text-purple-400/80 font-mono">
                E-Rank to S-Rank Monarch
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Awaken Your Skills. Level Up.
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-600 dark:text-purple-300/80 leading-relaxed">
              Upload your resume, select your dungeon tier, and face calibrated AI technical challenges. Correct answers boost your Hunter level; inaccurate answers trigger a <span className="text-rose-600 dark:text-rose-400 font-semibold font-mono">-1/3 score penalty</span>.
            </p>
          </div>
        </div>

        {/* 3 Executive KPI Stat Cards */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="rounded-2xl border border-purple-200/90 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-purple-300/70">
              <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <p className="text-[11px] font-mono font-medium">Cleared</p>
            </div>
            <p className="mt-1 text-xl font-black text-purple-700 dark:text-purple-300 font-mono">
              {completed.length}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200/90 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-purple-300/70">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-[11px] font-mono font-medium">Avg Score</p>
            </div>
            <p className="mt-1 text-xl font-black text-purple-700 dark:text-purple-300 font-mono">
              {average === null ? '—' : `${average.toFixed(1)}`}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200/90 bg-white p-3.5 shadow-sm transition hover:shadow-md dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-purple-300/70">
              <Award className="h-4 w-4 text-emerald-500" />
              <p className="text-[11px] font-mono font-medium">Top Score</p>
            </div>
            <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {bestScore === null ? '—' : `${bestScore.toFixed(1)}`}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Daily Willpower Surge Quotes Widget */}
      <MotivationalQuotesCard />

      {/* 4. Main Operational Layout (Balanced 2-Column Architecture) */}
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Column: Interview Arena Setup Form */}
        <section className="space-y-6">
          <div className="rounded-3xl border border-purple-200/90 bg-white p-6 shadow-sm backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0d071a] sm:p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-purple-100 dark:border-purple-900/50 pb-4">
              <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Enter Practice Arena
                </h2>
                <p className="text-xs text-slate-500 dark:text-purple-300/70">
                  Configure your interview raid format, tier, and grounding context.
                </p>
              </div>
            </div>

            {/* Resume Upload & Grounding Context */}
            <div className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/50 p-4 dark:border-purple-800/80 dark:bg-[#120a24]">
              <div className="flex items-start gap-3">
                <UploadCloud className="mt-0.5 h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Hunter Resume Context
                    </p>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-purple-300/60">
                      PDF or DOCX (max 5 MB)
                    </span>
                  </div>

                  {resumesQuery.data?.length ? (
                    <select
                      value={resumeId}
                      onChange={(event) => setResumeId(event.target.value)}
                      className="mt-2.5 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-100 dark:focus:ring-purple-900/50"
                    >
                      <option value="">Choose an uploaded resume</option>
                      {resumesQuery.data.map((resume) => (
                        <option key={resume.id} value={resume.id}>
                          {resume.filename}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-purple-300/70">
                      No hunter resumes uploaded yet. Upload your CV to enable AI grounding.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition dark:border-purple-800 dark:bg-[#180e30] dark:text-purple-300 dark:hover:bg-purple-950">
                      Browse File
                      <input
                        className="sr-only"
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    <span className="max-w-44 truncate text-xs text-slate-500 dark:text-purple-300/60 font-mono">
                      {file?.name || 'No file chosen'}
                    </span>
                    {file && (
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                        className="rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600 disabled:opacity-60 transition dark:bg-purple-600 dark:hover:bg-purple-500"
                      >
                        {uploadMutation.isPending ? 'Uploading…' : 'Upload Resume'}
                      </button>
                    )}
                    {uploadMutation.isSuccess && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                      </span>
                    )}
                  </div>

                  {/* Skills Arsenal Pills */}
                  {selectedResume?.profile && (
                    <div className="mt-3 space-y-1.5 rounded-xl border border-purple-200/80 bg-white p-3 text-xs dark:bg-[#180e30] dark:border-purple-900/60">
                      <p className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        Identified Skill Arsenal
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(selectedResume.profile.technologies || selectedResume.profile.skills || [])
                          .slice(0, 10)
                          .map((skill, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 dark:border dark:border-purple-800/80"
                            >
                              {skill}
                            </span>
                          ))}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-purple-400/60 font-mono pt-1">
                        {(selectedResume.profile.projects || []).length} projects · {(selectedResume.profile.experience || []).length} work experiences
                      </p>
                    </div>
                  )}

                  {/* Resume List Item Management */}
                  {resumesQuery.data?.length ? (
                    <div className="mt-2.5 divide-y divide-purple-100 dark:divide-purple-900/30">
                      {resumesQuery.data.map((resume) => (
                        <div
                          key={resume.id}
                          className="flex items-center justify-between gap-2 py-1 text-xs text-slate-600 dark:text-purple-300"
                        >
                          <span className="truncate max-w-[200px]">{resume.filename}</span>
                          <div className="flex shrink-0 gap-1.5">
                            <label className="cursor-pointer rounded px-2 py-0.5 text-[11px] text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-950">
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
                              className="rounded px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
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

            {/* Arena Form */}
            <form onSubmit={handleStart} className="space-y-5">
              {/* Interview Format Selection */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-300">
                  1. Interview Format
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { mode: 'text', title: 'Text Chat', desc: 'Type answers', icon: MessageSquare },
                    { mode: 'audio', title: 'Audio Call', desc: 'Voice synthesis', icon: PhoneCall },
                    { mode: 'video', title: 'Video Call', desc: 'Photorealistic AI', icon: Video },
                  ].map(({ mode, title, desc, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setInterviewMode(mode as any)}
                      className={`flex flex-col items-start rounded-2xl border p-3 text-left transition ${
                        interviewMode === mode
                          ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950/80 dark:text-purple-200 dark:ring-purple-700 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50 dark:border-purple-900/50 dark:bg-[#140b27]/60 dark:text-purple-300/70 dark:hover:border-purple-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${interviewMode === mode ? 'text-purple-700 dark:text-purple-300' : 'text-slate-400 dark:text-purple-400/60'}`} />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</span>
                      </div>
                      <span className="mt-1 text-[10px] text-slate-500 dark:text-purple-400/60">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-300">
                    2. Dungeon Difficulty & Score Multipliers
                  </label>
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                    Correct gives +pts · Subpar incurs -1/3 penalty
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'easy', label: 'Easy Dungeon', reward: '+6 pts', penalty: '-2.0 pts' },
                    { id: 'medium', label: 'Medium Raid', reward: '+10 pts', penalty: '-3.3 pts' },
                    { id: 'hard', label: 'Hard Gate', reward: '+15 pts', penalty: '-5.0 pts' },
                  ].map(({ id: level, label, reward, penalty }) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`rounded-2xl border p-3 text-center transition ${
                        difficulty === level
                          ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-300 dark:border-purple-500 dark:bg-purple-950/80 dark:text-purple-200 dark:ring-purple-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-slate-50 dark:border-purple-900/50 dark:bg-[#140b27]/60 dark:text-purple-300/70 dark:hover:border-purple-700'
                      }`}
                    >
                      <span className="block text-xs font-bold capitalize text-slate-900 dark:text-slate-100">{label}</span>
                      <span className="mt-1 block text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{reward}</span>
                      <span className="block text-[10px] font-mono text-rose-600 dark:text-rose-400">{penalty}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid 2x2 Parameters */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="question-count" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Number of Questions
                  </label>
                  <select
                    id="question-count"
                    value={numQuestions}
                    onChange={(event) => setNumQuestions(Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#140b27] dark:text-purple-100 dark:focus:ring-purple-900/50"
                  >
                    {Array.from({ length: 13 }, (_, index) => index + 3).map((n) => (
                      <option key={n} value={n}>
                        {n} questions
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="timer" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Timer Per Question
                  </label>
                  <select
                    id="timer"
                    value={timerSeconds}
                    onChange={(event) => setTimerSeconds(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#140b27] dark:text-purple-100 dark:focus:ring-purple-900/50"
                  >
                    <option value="">No timer (unlimited)</option>
                    <option value="60">1 minute</option>
                    <option value="120">2 minutes</option>
                    <option value="180">3 minutes</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="interview-category" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Question Category
                  </label>
                  <select
                    id="interview-category"
                    value={interviewCategory}
                    onChange={(event) => setInterviewCategory(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#140b27] dark:text-purple-100 dark:focus:ring-purple-900/50"
                  >
                    <option value="mixed">Mixed (Technical & System)</option>
                    <option value="technical">Technical Only</option>
                    <option value="hr">HR & Culture Fit</option>
                    <option value="behavioral">Behavioral & Leadership</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="experience-level" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Experience Level
                  </label>
                  <select
                    id="experience-level"
                    value={experienceLevel}
                    onChange={(event) => setExperienceLevel(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#140b27] dark:text-purple-100 dark:focus:ring-purple-900/50"
                  >
                    <option value="fresher">Fresher (0-1 yrs)</option>
                    <option value="junior">Junior (1-3 yrs)</option>
                    <option value="mid">Mid-level (3-5 yrs)</option>
                    <option value="senior">Senior (5+ yrs)</option>
                    <option value="lead">Lead / Architect</option>
                  </select>
                </div>
              </div>

              {/* Target Role */}
              <div>
                <label htmlFor="target-role" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Role Calibration <span className="font-normal text-slate-400 dark:text-purple-400/60">(optional)</span>
                </label>
                <input
                  id="target-role"
                  maxLength={100}
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer, Distributed Systems Lead"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-[#140b27] dark:text-purple-100 dark:placeholder:text-purple-400/40 dark:focus:ring-purple-900/50"
                />
              </div>

              {/* Form Error Alert */}
              {(formError || createMutation.error) && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  {formError || createMutation.error?.message}
                </div>
              )}

              {/* CTA Submit Button */}
              <button
                disabled={createMutation.isPending || uploadMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 px-4 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] transition hover:from-purple-600 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 transform hover:scale-[1.005] active:scale-[0.995]"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating questions with Gemini…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Enter Practice Arena
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: Analytics & Raid Records */}
        <section className="space-y-6">
          {/* Progress Trend Chart Card */}
          <div className="rounded-3xl border border-purple-200/90 bg-white p-6 shadow-sm backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0d071a] sm:p-7 space-y-5">
            <div className="flex items-center gap-3 border-b border-purple-100 dark:border-purple-900/50 pb-4">
              <div className="rounded-xl bg-purple-100 p-2.5 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Hunter Progression Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-purple-300/70">
                  Historical score trajectory across completed interview raids.
                </p>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: '#888' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 11, fill: '#888' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="overall_score"
                      stroke="#9333ea"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#9333ea' }}
                      activeDot={{ r: 6, fill: '#a855f7' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-center dark:border-purple-900/50 dark:bg-[#120a24]">
                <BarChart3 className="h-8 w-8 text-purple-300 dark:text-purple-600" />
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-purple-200">
                  Your trend line starts here
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-purple-400/60">
                  Complete your first dungeon raid to view your score trajectory.
                </p>
              </div>
            )}
          </div>

          {/* Recent Dungeon Raid Records */}
          <div className="overflow-hidden rounded-3xl border border-purple-200/90 bg-white shadow-sm backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0d071a]">
            <div className="flex items-center justify-between border-b border-purple-100 px-6 py-4 dark:border-purple-900/50">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Dungeon Raid Records
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-purple-400/60">
                {sessionsQuery.data?.items.length || 0} Logs
              </span>
            </div>

            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-slate-500 dark:text-purple-300/70 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Loading battle logs…
              </div>
            ) : sessionsQuery.error ? (
              <p role="alert" className="p-6 text-xs text-rose-700 dark:text-rose-400">
                {(sessionsQuery.error as Error).message}
              </p>
            ) : sessionsQuery.data?.items.length ? (
              <div className="divide-y divide-purple-100 dark:divide-purple-900/40 max-h-[380px] overflow-y-auto">
                {sessionsQuery.data.items.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-2.5 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-purple-100 truncate max-w-[190px]">
                          {session.target_role || 'General Interview'}
                        </p>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border dark:border-purple-800/80">
                          {session.difficulty}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-purple-400/70 font-mono">
                        {dateLabel(session.created_at)} · {session.num_questions} Qs ·{' '}
                        {session.status === 'completed' ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {session.overall_score?.toFixed(1) ?? '—'}/10
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            In progress
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={session.status === 'completed' ? `/summary/${session.id}` : `/interview/${session.id}`}
                        className="rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-200 transition dark:bg-purple-900/60 dark:text-purple-200 dark:hover:bg-purple-800"
                      >
                        {session.status === 'completed' ? 'Debrief' : 'Resume'}
                      </Link>
                      <button
                        aria-label={`Delete session ${session.id}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Delete this raid log and report?')) deleteMutation.mutate(session.id);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition dark:text-purple-400/60 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700 dark:text-purple-200">
                  No battle records yet
                </p>
                <p className="text-[11px] text-slate-500 dark:text-purple-400/60">
                  Awaken your hunter journey by entering your first dungeon raid above.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
