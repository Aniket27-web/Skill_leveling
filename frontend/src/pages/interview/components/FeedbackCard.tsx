import React, { useState } from 'react';
import { Dimensions, EvalStatus } from '../../../api/types';
import { LevelDeltaCalculation } from '../../../services/skillLeveling';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  Flag,
  Sparkles,
  Zap,
} from 'lucide-react';

export interface FeedbackCardProps {
  evalStatus: EvalStatus;
  score: number | null;
  dimensions: Dimensions | null;
  strengths: string[];
  improvements: string[];
  missedPoints?: string[];
  idealOutline?: string[];
  isLastQuestion: boolean;
  isRetrying?: boolean;
  isCompleting?: boolean;
  deltaInfo?: LevelDeltaCalculation | null;
  onNextOrFinish: () => void;
  onRetryEval?: () => void;
  onContinueAnyway?: () => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  evalStatus,
  score,
  dimensions,
  strengths = [],
  improvements = [],
  missedPoints = [],
  idealOutline = [],
  isLastQuestion,
  isRetrying = false,
  isCompleting = false,
  deltaInfo,
  onNextOrFinish,
  onRetryEval,
  onContinueAnyway,
}) => {
  const [showOutline, setShowOutline] = useState<boolean>(false);

  // Failure state UX
  if (evalStatus === 'failed') {
    return (
      <div
        className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm transition-all dark:border-amber-800 dark:bg-amber-950/40"
        data-testid="feedback-card-failed"
      >
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
              We saved your answer but couldn't evaluate it
            </h3>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
              Our AI evaluation service encountered a temporary issue. Your answer is safely stored.
              You can retry the evaluation now or continue to the next question.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onRetryEval}
                disabled={isRetrying}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
                data-testid="retry-eval-button"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying evaluation...' : 'Retry evaluation'}
              </button>

              <button
                type="button"
                onClick={onContinueAnyway || onNextOrFinish}
                className="inline-flex items-center px-4 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-sm font-medium transition dark:border-amber-700 dark:bg-[#180e30] dark:text-amber-200"
                data-testid="continue-anyway-button"
              >
                Continue anyway
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal evaluated feedback card
  const safeScore = score !== null && score !== undefined ? score : 0;
  const dimensionList: Array<{ key: keyof Dimensions; label: string }> = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'depth', label: 'Depth' },
    { key: 'clarity', label: 'Clarity' },
  ];

  return (
    <div
      className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm space-y-6 transition-all dark:border-purple-900/60 dark:bg-[#0d071a]"
      data-testid="feedback-card"
    >
      {/* Hunter Level Delta Banner */}
      {deltaInfo && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
            deltaInfo.isCorrect
              ? 'border-purple-500/60 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'border-rose-500/50 bg-gradient-to-r from-rose-950/30 via-purple-950/20 to-rose-950/30 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`rounded-lg p-2 ${
                deltaInfo.isCorrect ? 'bg-purple-600/30 text-purple-400' : 'bg-rose-600/30 text-rose-400'
              }`}
            >
              {deltaInfo.isCorrect ? <Sparkles className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <p
                className={`text-xs font-black uppercase tracking-wider font-mono ${
                  deltaInfo.isCorrect ? 'text-purple-700 dark:text-purple-300' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {deltaInfo.isCorrect ? '⚡ Hunter Awakening · Level Progress' : '⚠️ System Penalty · 1/3 Deduction Applied'}
              </p>
              <p className="text-xs text-slate-700 dark:text-purple-200/90 font-sans mt-0.5">
                {deltaInfo.reason}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`font-mono text-base font-black px-3 py-1 rounded-lg border ${
                deltaInfo.isCorrect
                  ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-400'
                  : 'border-rose-500/50 bg-rose-950/50 text-rose-400'
              }`}
            >
              {deltaInfo.delta > 0 ? `+${deltaInfo.delta}` : deltaInfo.delta} LVL
            </span>
          </div>
        </div>
      )}

      {/* Top Banner: Score and Overall Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-purple-100 dark:border-purple-900/50">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Evaluation Feedback
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">Answer Evaluation</h3>
        </div>

        {/* Animated Score Badge */}
        <div className="flex items-center space-x-3 bg-slate-50 dark:bg-[#150c29] px-4 py-2 rounded-xl border border-purple-200 dark:border-purple-900/60 shadow-inner">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-purple-300/70 tracking-wider font-mono">
            Score
          </span>
          <div className="flex items-baseline space-x-1">
            <span
              className={`text-3xl font-extrabold transition-all duration-700 ${
                safeScore >= 8
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : safeScore >= 5
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
              data-testid="score-value"
            >
              {safeScore}
            </span>
            <span className="text-sm font-medium text-slate-400 dark:text-purple-400/60">/10</span>
          </div>
        </div>
      </div>

      {/* 4 Dimension Progress Bars */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-purple-300/70 mb-3 font-mono">
          Dimension Breakdown
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="dimension-bars">
          {dimensionList.map(({ key, label }) => {
            const rawVal = dimensions ? dimensions[key] : null;
            const dimScore = rawVal !== null && rawVal !== undefined ? rawVal : 0;
            const percent = Math.min(100, Math.max(0, (dimScore / 10) * 100));

            return (
              <div
                key={key}
                className="bg-slate-50 dark:bg-[#150c29] p-3 rounded-lg border border-purple-100 dark:border-purple-900/50"
              >
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-purple-200 mb-1">
                  <span>{label}</span>
                  <span className="text-slate-900 dark:text-purple-100 font-bold font-mono">
                    {rawVal !== null ? `${dimScore}/10` : '—'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-purple-950/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-indigo-500 h-2 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(147,51,234,0.5)]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths (Green) */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Key Strengths</span>
          </div>
          {strengths && strengths.length > 0 ? (
            <ul
              className="space-y-1.5 text-xs text-emerald-950 dark:text-emerald-200/90 pl-5 list-disc"
              data-testid="strengths-list"
            >
              {strengths.map((st, i) => (
                <li key={i}>{st}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-400/70 italic">No specific strengths recorded.</p>
          )}
        </div>

        {/* Improvements (Amber) */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-400 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Areas for Improvement</span>
          </div>
          {improvements && improvements.length > 0 ? (
            <ul
              className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200/90 pl-5 list-disc"
              data-testid="improvements-list"
            >
              {improvements.map((imp, i) => (
                <li key={i}>{imp}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400/70 italic">No specific improvements suggested.</p>
          )}
        </div>
      </div>

      {/* Missed Points (if any) */}
      {missedPoints && missedPoints.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-400 font-semibold text-sm">
            <Flag className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>Missed Key Points</span>
          </div>
          <ul
            className="space-y-1.5 text-xs text-rose-950 dark:text-rose-200/90 pl-5 list-disc"
            data-testid="missed-points-list"
          >
            {missedPoints.map((mp, i) => (
              <li key={i}>{mp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Collapsible Ideal Answer Outline */}
      {idealOutline && idealOutline.length > 0 && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-900/50 overflow-hidden bg-slate-50 dark:bg-[#150c29]">
          <button
            type="button"
            onClick={() => setShowOutline(!showOutline)}
            className="w-full flex items-center justify-between p-3.5 text-left text-sm font-semibold text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-[#1f123d] transition"
            data-testid="toggle-ideal-outline"
          >
            <div className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Ideal Answer Outline</span>
            </div>
            {showOutline ? (
              <ChevronUp className="h-4 w-4 text-slate-500 dark:text-purple-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500 dark:text-purple-400" />
            )}
          </button>
          {showOutline && (
            <div
              className="p-4 pt-1 bg-white dark:bg-[#120a24] border-t border-purple-200 dark:border-purple-900/50"
              data-testid="ideal-outline-content"
            >
              <ol className="space-y-2 text-xs text-slate-700 dark:text-purple-200/90 list-decimal pl-5">
                {idealOutline.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Next / Finish Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onNextOrFinish}
          disabled={isCompleting}
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(147,51,234,0.4)] transition disabled:opacity-50"
          data-testid="next-or-finish-button"
        >
          {isCompleting ? (
            'Finishing session...'
          ) : isLastQuestion ? (
            <>
              Finish session
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Next question
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
