import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessions, useDeleteSession, downloadReport } from '../../api/hooks';
import { Session } from '../../api/types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ScoreBadge } from '../../components/ScoreBadge';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/Toast';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  Play,
  FileCheck2,
  Calendar,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

const PAGE_SIZE = 10;

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [page, setPage] = useState<number>(0);
  const offset = page * PAGE_SIZE;

  const { data, isLoading, error, refetch } = useSessions(PAGE_SIZE, offset);
  const deleteSessionMutation = useDeleteSession();

  // Expanded row state
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // Delete modal state
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  // Report downloading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDownloadReport = async (sessionId: string) => {
    try {
      setDownloadingId(sessionId);
      await downloadReport(sessionId);
      toast.success('Performance report downloaded successfully!');
    } catch {
      toast.error('Failed to download report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    const target = sessionToDelete;
    setSessionToDelete(null);

    try {
      await deleteSessionMutation.mutateAsync(target.id);
      toast.success('Interview session deleted successfully');
    } catch {
      toast.error('Failed to delete session. Reverting state.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-slate-400">Loading interview records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load interview history"
        message="Unable to retrieve interview session logs from the server."
        onRetry={() => refetch()}
      />
    );
  }

  const sessions = data?.sessions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Interview History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review past mock interview questions, AI feedback, and detailed performance reports.
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

      {sessions.length === 0 ? (
        <EmptyState
          title="No interview history found"
          description="You haven't completed or started any mock interviews yet. Create a session to start tracking your progress."
          actionText="Start New Session"
          onAction={() => navigate('/sessions/new')}
        />
      ) : (
        <>
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedSessionIds.has(session.id);
              const isCompleted = session.status === 'completed';

              return (
                <Card
                  key={session.id}
                  className={clsx(
                    'transition-all duration-200 p-0 overflow-hidden border',
                    isExpanded ? 'border-teal-500/40 shadow-xl' : 'border-slate-800 hover:border-slate-700'
                  )}
                >
                  {/* Summary Bar */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => toggleExpand(session.id)}
                        aria-label={isExpanded ? 'Collapse row details' : 'Expand row details'}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors mt-0.5 sm:mt-0 shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-1.5">
                            <Briefcase className="w-4 h-4 text-teal-400 shrink-0" />
                            {session.target_role || 'General Software Engineering'}
                          </h3>
                          <span
                            className={clsx(
                              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                              session.difficulty === 'hard'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : session.difficulty === 'medium'
                                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            )}
                          >
                            {session.difficulty}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {session.created_at ? session.created_at.split('T')[0] : 'N/A'}
                          </span>
                          <span>•</span>
                          <span>{session.question_count} Questions</span>
                          {session.timer_seconds && (
                            <>
                              <span>•</span>
                              <span>{session.timer_seconds}s timer</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions and Status */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 md:pt-0 border-t border-slate-800 md:border-t-0">
                      <div>
                        {isCompleted ? (
                          <ScoreBadge score={session.overall_score} size="md" showLabel />
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            In Progress
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCompleted ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/summary/${session.id}`)}
                              className="text-xs"
                              leftIcon={<FileCheck2 className="w-3.5 h-3.5 text-teal-400" />}
                            >
                              View Summary
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={downloadingId === session.id}
                              onClick={() => handleDownloadReport(session.id)}
                              className="text-xs"
                              title="Download Report"
                              aria-label="Download Report"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-300" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/interview/${session.id}`)}
                            className="text-xs"
                            rightIcon={<Play className="w-3.5 h-3.5" />}
                          >
                            Resume
                          </Button>
                        )}

                        <button
                          onClick={() => setSessionToDelete(session)}
                          aria-label="Delete session"
                          title="Delete session"
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Content: Questions & Answers */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 bg-slate-950/60 border-t border-slate-800 space-y-4 animate-fade-in">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Questions & Evaluated Responses
                      </h4>

                      {session.questions && session.questions.length > 0 ? (
                        <div className="space-y-4">
                          {session.questions.map((q, idx) => (
                            <div
                              key={q.id || idx}
                              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-semibold text-sm text-teal-300 leading-snug">
                                  Q{idx + 1}: {q.text}
                                </span>
                                <ScoreBadge score={q.score} size="sm" />
                              </div>

                              <div>
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Candidate's Answer:
                                </span>
                                <p className="text-xs text-slate-200 mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800/60 leading-relaxed font-mono">
                                  {q.user_answer || '(No answer provided)'}
                                </p>
                              </div>

                              {(q.strengths || q.improvements) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                  {q.strengths && q.strengths.length > 0 && (
                                    <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                                      <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wider">
                                        Strengths:
                                      </span>
                                      <ul className="list-disc list-inside mt-1 text-slate-300 space-y-1">
                                        {q.strengths.map((str, sIdx) => (
                                          <li key={sIdx}>{str}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {q.improvements && q.improvements.length > 0 && (
                                    <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20">
                                      <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">
                                        Areas for Improvement:
                                      </span>
                                      <ul className="list-disc list-inside mt-1 text-slate-300 space-y-1">
                                        {q.improvements.map((imp, iIdx) => (
                                          <li key={iIdx}>{imp}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No question breakdown available for this session.</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Page {page + 1} of {totalPages} ({total} total sessions)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(sessionToDelete)}
        onClose={() => setSessionToDelete(null)}
        title="Delete Interview Session?"
        description="This action cannot be undone."
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setSessionToDelete(null)}
              data-testid="cancel-delete-btn"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmDelete}
              isLoading={deleteSessionMutation.isPending}
              data-testid="confirm-delete-btn"
            >
              Delete Session
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-rose-500/10 text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-300">
            Are you sure you want to permanently delete the mock interview session for{' '}
            <strong className="text-white">
              {sessionToDelete?.target_role || 'General Software Engineering'}
            </strong>{' '}
            from {sessionToDelete?.created_at?.split('T')[0]}? All question evaluations will be removed.
          </p>
        </div>
      </Modal>
    </div>
  );
};
