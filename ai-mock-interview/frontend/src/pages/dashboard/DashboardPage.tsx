import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useSessions, useProgress } from '../../api/hooks';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/Card';
import { Button } from '../../components/Button';
import { ScoreBadge } from '../../components/ScoreBadge';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import {
  PlusCircle,
  TrendingUp,
  Award,
  Layers,
  ArrowRight,
  Sparkles,
  Calendar,
  Briefcase,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError, refetch } = useSessions(10, 0);
  const { data: progressData } = useProgress();

  if (sessionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-slate-400">Loading your interview dashboard...</p>
      </div>
    );
  }

  if (sessionsError) {
    return (
      <ErrorState
        title="Failed to load dashboard data"
        message="Unable to fetch your mock interview records. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  const sessions = sessionsData?.sessions || [];
  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' && s.overall_score !== null && s.overall_score !== undefined
  );

  const lastThreeSessions = sessions.slice(0, 3);
  const latestSession = completedSessions[0];
  const latestScore = latestSession?.overall_score ?? null;
  const averageScore = progressData?.average_score ?? (
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) /
            completedSessions.length
        )
      : null
  );
  const totalSessions = sessionsData?.total || sessions.length;

  // Mini trend chart data from history
  const chartData = (progressData?.history || []).slice(-7).map((item) => ({
    date: item.date.slice(5),
    score: item.overall_score,
  }));

  const firstName = user?.name ? user.name.split(' ')[0] : 'Engineer';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 sm:p-8 rounded-2xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-teal-950/20">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            AI Mock Interview Ready
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Sharpen your responses, practice realistic system design & coding prompts, and track your interview readiness.
          </p>
        </div>
        <div className="shrink-0">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/sessions/new')}
            leftIcon={<PlusCircle className="w-5 h-5" />}
          >
            Start New Session
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No interview sessions yet"
          description="Upload your resume, customize your target role and difficulty, and run your first AI-evaluated mock interview."
          actionText="Start your first session"
          onAction={() => navigate('/sessions/new')}
        />
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Latest Score */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Latest Score
                </span>
                <Award className="w-4 h-4 text-teal-400" />
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-black text-white">
                  {latestScore !== null ? `${latestScore}%` : 'N/A'}
                </span>
                <ScoreBadge score={latestScore} size="sm" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {latestSession?.target_role || 'Recent interview evaluation'}
              </p>
            </Card>

            {/* Average Score */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Average Score
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-black text-white">
                  {averageScore !== null ? `${averageScore}%` : 'N/A'}
                </span>
                <ScoreBadge score={averageScore} size="sm" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Across {completedSessions.length} evaluated interview sessions
              </p>
            </Card>

            {/* Total Sessions */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Sessions
                </span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-black text-white">{totalSessions}</span>
                <span className="text-xs font-medium text-slate-400">sessions created</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {sessions.filter((s) => s.status === 'in_progress').length} in progress
              </p>
            </Card>
          </div>

          {/* Mini Trend Chart & Last 3 Sessions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Chart (Span 2 cols on lg) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Performance Momentum</CardTitle>
                    <CardDescription>Overall evaluation score trajectory</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/progress')}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    View Analytics
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length >= 2 ? (
                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} domain={[40, 100]} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#090d16',
                            borderColor: '#334155',
                            borderRadius: '0.75rem',
                            color: '#f8fafc',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#scoreGlow)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-sm text-center">
                    <TrendingUp className="w-8 h-8 text-slate-600 mb-2" />
                    Complete at least 2 sessions to unlock your performance trend chart.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent 3 Sessions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Sessions</CardTitle>
                    <CardDescription>Your last 3 practice runs</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/history')}
                    className="text-xs"
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lastThreeSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      if (session.status === 'in_progress') {
                        navigate(`/interview/${session.id}`);
                      } else {
                        navigate(`/summary/${session.id}`);
                      }
                    }}
                    className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-teal-500/30 hover:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate group-hover:text-teal-300 transition-colors">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{session.target_role || 'General Interview'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {session.created_at.split('T')[0]}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{session.difficulty}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {session.status === 'in_progress' ? (
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Resume
                        </span>
                      ) : (
                        <ScoreBadge score={session.overall_score} size="sm" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
