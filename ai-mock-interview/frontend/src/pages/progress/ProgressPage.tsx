import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProgress } from '../../api/hooks';
import { Difficulty } from '../../api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import {
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Filter,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { clsx } from 'clsx';

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useProgress();

  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-slate-400">Loading progress analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load progress analytics"
        message="Unable to retrieve interview performance trends."
        onRetry={() => refetch()}
      />
    );
  }

  const rawHistory = data?.history || [];

  // Filter history by difficulty if selected
  const filteredHistory =
    difficultyFilter === 'all'
      ? rawHistory
      : rawHistory.filter((item) => item.difficulty === difficultyFilter);

  // Compute 3-session moving average
  const chartData = filteredHistory.map((item, index, arr) => {
    const slice = arr.slice(Math.max(0, index - 2), index + 1);
    const movingAvg = Math.round((slice.reduce((acc, curr) => acc + curr.overall_score, 0) / slice.length) * 10) / 10;

    return {
      date: item.date,
      score: item.overall_score,
      movingAverage: movingAvg,
      difficulty: item.difficulty,
      role: item.target_role || 'General',
    };
  });

  const averageScore = data?.average_score ?? 0;
  const totalSessions = data?.total_sessions ?? 0;
  const scoreDelta = data?.score_delta ?? 0;
  const isPositiveDelta = scoreDelta >= 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Progress & Performance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track score trajectory, difficulty mastery, and moving averages over time.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/sessions/new')}
          leftIcon={<PlusCircle className="w-4 h-4" />}
        >
          New Session
        </Button>
      </div>

      {rawHistory.length < 2 ? (
        <EmptyState
          icon={<TrendingUp className="w-8 h-8" />}
          title="Fewer than 2 sessions completed"
          description="Complete at least 2 mock interview sessions to unlock trend curves, moving averages, and score delta analytics."
          actionText="Start a Mock Interview"
          onAction={() => navigate('/sessions/new')}
        />
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Score Delta */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Recent Momentum
                </span>
                {isPositiveDelta ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={clsx(
                    'text-3xl font-black',
                    isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {isPositiveDelta ? `+${scoreDelta}` : scoreDelta}
                </span>
                <span className="text-xs text-slate-400 font-medium">vs your average</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Compared against historical baseline</p>
            </Card>

            {/* Average Score */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Overall Average
                </span>
                <Award className="w-4 h-4 text-teal-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-white">{averageScore}%</span>
                <span className="text-xs text-slate-400 font-medium">across all evaluations</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Moving average: {data?.moving_average ?? averageScore}%
              </p>
            </Card>

            {/* Total Completed */}
            <Card hoverEffect>
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Evaluated Sessions
                </span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-white">{rawHistory.length}</span>
                <span className="text-xs text-slate-400 font-medium">of {totalSessions} total</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Data points plotted on analytics chart</p>
            </Card>
          </div>

          {/* Main Chart Card */}
          <Card className="p-6">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6">
              <div>
                <CardTitle>Score Progression & Moving Average</CardTitle>
                <CardDescription>
                  Tracking individual session scores along with a 3-session smoothed trendline.
                </CardDescription>
              </div>

              {/* Difficulty Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <div className="flex bg-slate-900/90 rounded-lg p-1 border border-slate-800">
                  {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficultyFilter(diff)}
                      className={clsx(
                        'px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize',
                        difficultyFilter === diff
                          ? 'bg-teal-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                  No sessions match the selected difficulty filter "{difficultyFilter}".
                </div>
              ) : (
                <div className="h-80 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[40, 100]} tickLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="rounded-xl glass-panel border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl text-xs space-y-1.5">
                                <p className="font-bold text-white flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                                  {p.date}
                                </p>
                                <p className="text-slate-300">
                                  Role: <span className="text-white font-medium">{p.role}</span>
                                </p>
                                <p className="text-slate-300">
                                  Difficulty:{' '}
                                  <span className="font-semibold text-teal-300 capitalize">{p.difficulty}</span>
                                </p>
                                <div className="pt-1.5 mt-1 border-t border-slate-800 flex items-center justify-between gap-4">
                                  <span className="text-teal-400 font-bold">Session Score: {p.score}%</span>
                                  <span className="text-emerald-400 font-medium">3-Sess Avg: {p.movingAverage}%</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(value) => (
                          <span className="text-xs text-slate-300 font-medium">{value}</span>
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="Session Score"
                        stroke="#14b8a6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#020617' }}
                        activeDot={{ r: 6, fill: '#2dd4bf' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="movingAverage"
                        name="3-Session Moving Average"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
