import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession, useCompleteSession, downloadReport } from '../../api/hooks';
import { Question } from '../../api/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Download,
  RotateCcw,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Award,
  Play,
  HelpCircle,
  Flag,
} from 'lucide-react';

export const SummaryPage: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = useSession(sessionId);

  const completeMutation = useCompleteSession();

  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const toggleExpand = (qid: string) => {
    setExpandedQuestionId((prev) => (prev === qid ? null : qid));
  };

  const handleDownloadPDF = async () => {
    if (!sessionId) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadReport(sessionId);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to download PDF report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFinishSession = async () => {
    if (!sessionId) return;
    try {
      await completeMutation.mutateAsync(sessionId);
      await refetch();
    } catch (err: any) {
      setDownloadError(err?.message || 'Could not complete session.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-slate-800">Loading interview summary...</h2>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-white border border-red-200 shadow-sm text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Summary Not Found</h2>
        <p className="text-sm text-slate-600 mt-1">
          {error?.message || 'Unable to locate interview session.'}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isInProgress = session.status === 'in_progress';
  const overallScore = session.overall_score !== null && session.overall_score !== undefined
    ? Number(session.overall_score)
    : null;

  // Circular score gauge metrics
  const scorePercent = overallScore !== null ? Math.min(100, Math.max(0, overallScore * 10)) : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  // Chart data
  const chartData = (session.questions || []).map((q, idx) => ({
    name: `Q${q.order_index ?? idx + 1}`,
    score: q.score !== null && q.score !== undefined ? q.score : 0,
    category: q.category,
  }));

  const summaryObj = session.summary;
  const topStrengths = summaryObj?.top_strengths || [];
  const focusAreas = summaryObj?.focus_areas || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" data-testid="summary-page">
      {/* Toast Alert for Download / Action Error */}
      {downloadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span>{downloadError}</span>
          </div>
          <button
            onClick={() => setDownloadError(null)}
            className="text-xs text-red-700 font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* In-Progress Session Notice */}
      {isInProgress && (
        <div
          className="rounded-2xl border border-amber-300 bg-amber-50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
          data-testid="in-progress-banner"
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-amber-950">This session is still in progress</h3>
              <p className="text-xs text-amber-800 mt-1">
                You have answered {session.answered_count} of {session.num_questions} questions. You can
                resume answering or finish early to finalize your evaluation.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/interview/${sessionId}`)}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              data-testid="resume-session-button"
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Resume interview
            </button>
            <button
              onClick={handleFinishSession}
              disabled={completeMutation.isPending}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold transition disabled:opacity-50"
              data-testid="finish-session-early-button"
            >
              {completeMutation.isPending ? 'Finishing...' : 'Finish session'}
            </button>
          </div>
        </div>
      )}

      {/* Hero Header: Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
              Session Completed
            </span>
            {session.difficulty && (
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full capitalize">
                {session.difficulty} difficulty
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">
            Interview Performance Summary
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {session.target_role || 'General Software Engineering'} • {session.num_questions} Questions
          </p>
        </div>

        {/* Action Buttons: Download PDF, Practice Again, View History */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            data-testid="download-report-button"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF report
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/sessions/new')}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
            data-testid="practice-again-button"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            Practice again
          </button>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
            data-testid="view-history-button"
          >
            <History className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            View history
          </button>
        </div>
      </div>

      {/* Top Grid: Overall Score Ring Gauge & Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Large Score Ring Gauge */}
        <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Overall Performance
          </span>

          <div className="relative w-36 h-36 flex items-center justify-center my-1">
            <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="text-slate-100 stroke-current"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={overallScore && overallScore >= 8 ? '#10B981' : overallScore && overallScore >= 5 ? '#2563EB' : '#F59E0B'}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold text-slate-900" data-testid="overall-score-display">
                {overallScore !== null ? overallScore.toFixed(1) : '—'}
              </span>
              <span className="text-xs font-semibold text-slate-400">OUT OF 10</span>
            </div>
          </div>

          <div className="mt-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                overallScore && overallScore >= 8
                  ? 'bg-emerald-100 text-emerald-800'
                  : overallScore && overallScore >= 6
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <Award className="h-3.5 w-3.5 mr-1" />
              {overallScore && overallScore >= 8
                ? 'Strong Match'
                : overallScore && overallScore >= 6
                ? 'Solid Foundation'
                : 'Developing Competency'}
            </span>
          </div>
        </div>

        {/* Executive Summary & Insights */}
        <div className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Executive Assessment</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed" data-testid="summary-text">
              {summaryObj?.text || (
                <span className="italic text-slate-400">
                  No executive summary text generated for this session. Review individual question breakdowns below.
                </span>
              )}
            </p>
          </div>

          {/* Top Strengths & Focus Areas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center space-x-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Top Strengths</span>
              </div>
              {topStrengths.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-emerald-950 pl-4 list-disc" data-testid="top-strengths-list">
                  {topStrengths.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700 italic">None noted</p>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Focus Areas</span>
              </div>
              {focusAreas.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-amber-950 pl-4 list-disc" data-testid="focus-areas-list">
                  {focusAreas.map((fa, i) => (
                    <li key={i}>{fa}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700 italic">None noted</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mini Bar Chart of Per-Question Scores */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Per-Question Score Trajectory</h3>
            <span className="text-xs text-slate-400 font-medium">Scores on 0 – 10 Scale</span>
          </div>

          <div className="h-56 w-full" data-testid="score-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} / 10`, 'Score']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.score >= 8 ? '#10B981' : entry.score >= 5 ? '#2563EB' : '#F59E0B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-Question Detailed Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Question-by-Question Detailed Feedback</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click on any question row to expand the full evaluation, dimension metrics, and ideal outline.
          </p>
        </div>

        <div className="divide-y divide-slate-100" data-testid="question-breakdown-list">
          {(session.questions || []).map((q: Question, idx: number) => {
            const isExpanded = expandedQuestionId === q.id;
            const qScore = q.score !== null && q.score !== undefined ? q.score : 0;
            const isAnswered = Boolean(q.answer_text && q.answer_text.trim());

            return (
              <div key={q.id || idx} className="transition">
                {/* Row Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(q.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-50 transition"
                  data-testid={`question-row-${q.order_index ?? idx + 1}`}
                >
                  <div className="flex items-start space-x-3.5 pr-4 flex-1">
                    <span className="h-7 w-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                      Q{q.order_index ?? idx + 1}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded capitalize">
                          {q.category}
                        </span>
                        {!isAnswered && (
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            Not answered
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">{q.text}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 flex-shrink-0">
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isAnswered
                            ? qScore >= 8
                              ? 'bg-emerald-100 text-emerald-800'
                              : qScore >= 5
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isAnswered ? `${qScore}/10` : '0/10'}
                      </span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Feedback Panel */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/70 border-t border-slate-100 space-y-4">
                    {/* Full Question Prompt */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Question Prompt
                      </h4>
                      <p className="text-sm font-semibold text-slate-900">{q.text}</p>
                    </div>

                    {/* Candidate Answer */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Candidate's Response
                      </h4>
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 leading-relaxed">
                        {isAnswered ? (
                          q.answer_text
                        ) : (
                          <span className="text-slate-400 italic">Not answered (0/10)</span>
                        )}
                      </div>
                    </div>

                    {/* 4 Dimension Bars */}
                    {q.dimensions && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Evaluated Dimensions
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(q.dimensions).map(([dimName, scoreVal]) => (
                            <div key={dimName} className="p-2.5 rounded-lg bg-white border border-slate-200 text-center">
                              <span className="block text-[10px] font-semibold uppercase text-slate-400 capitalize">
                                {dimName}
                              </span>
                              <span className="text-sm font-bold text-slate-800">{scoreVal}/10</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {q.strengths && q.strengths.length > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                          <span className="text-xs font-bold text-emerald-900">Strengths</span>
                          <ul className="text-xs text-emerald-950 pl-4 list-disc space-y-0.5">
                            {q.strengths.map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {q.improvements && q.improvements.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                          <span className="text-xs font-bold text-amber-900">Improvements</span>
                          <ul className="text-xs text-amber-950 pl-4 list-disc space-y-0.5">
                            {q.improvements.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Missed Points */}
                    {q.missed_points && q.missed_points.length > 0 && (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-1">
                        <span className="text-xs font-bold text-rose-900">Missed Key Points</span>
                        <ul className="text-xs text-rose-950 pl-4 list-disc space-y-0.5">
                          {q.missed_points.map((mp, i) => (
                            <li key={i}>{mp}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Ideal Outline */}
                    {q.ideal_outline && q.ideal_outline.length > 0 && (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                        <span className="text-xs font-bold text-slate-700">Ideal Outline</span>
                        <ol className="text-xs text-slate-600 pl-4 list-decimal space-y-0.5">
                          {q.ideal_outline.map((io, i) => (
                            <li key={i}>{io}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
