import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useSession,
  useSubmitAnswer,
  useRetryEval,
  useCompleteSession,
} from '../../api/hooks';
import { useCountdown } from './hooks/useCountdown';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useDeliveryStats } from './hooks/useDeliveryStats';
import { CountdownTimer } from './components/CountdownTimer';
import { FeedbackCard } from './components/FeedbackCard';
import { DeliveryStatsView } from './components/DeliveryStatsView';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const InterviewPage: React.FC = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Query session with polling if preparing next question
  const [isPreparingNext, setIsPreparingNext] = useState<boolean>(false);
  const {
    data: session,
    isLoading: isSessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useSession(sessionId, {
    refetchInterval: isPreparingNext ? 2000 : false,
  });

  const submitAnswerMutation = useSubmitAnswer();
  const retryEvalMutation = useRetryEval();
  const completeSessionMutation = useCompleteSession();

  // Redirect to summary if session is already completed
  useEffect(() => {
    if (session?.status === 'completed' && sessionId) {
      navigate(`/summary/${sessionId}`, { replace: true });
    }
  }, [session?.status, sessionId, navigate]);

  // Identify current active question
  const currentQ = session?.current_question;
  const currentQId = currentQ?.id;

  // Track if we are waiting for server to prepare the next question
  useEffect(() => {
    if (session?.status === 'in_progress' && !currentQ) {
      setIsPreparingNext(true);
    } else {
      setIsPreparingNext(false);
    }
  }, [session?.status, currentQ]);

  // Per-question state: draft answer, idempotency key, submission status
  const [answerText, setAnswerText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [justEvaluatedFeedback, setJustEvaluatedFeedback] = useState<any | null>(null);

  // Cached idempotency keys per question id
  const idempotencyKeysRef = useRef<Record<string, string>>({});

  const getIdempotencyKey = (qid: string): string => {
    if (!idempotencyKeysRef.current[qid]) {
      idempotencyKeysRef.current[qid] = generateUUID();
    }
    return idempotencyKeysRef.current[qid];
  };

  // 1. Per-question draft in React state and mirrored to sessionStorage
  useEffect(() => {
    if (!currentQId) return;

    const storageKey = `draft_answer_${sessionId}_${currentQId}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) {
      setAnswerText(saved);
    } else {
      setAnswerText('');
    }
    setNetworkError(null);
    setJustEvaluatedFeedback(null);
  }, [currentQId, sessionId]);

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value.slice(0, 4000);
    setAnswerText(text);
    if (currentQId && sessionId) {
      sessionStorage.setItem(`draft_answer_${sessionId}_${currentQId}`, text);
    }
  };

  // 2. Beforeunload warning when there is unsent text
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (answerText.trim().length > 0 && !justEvaluatedFeedback) {
        e.preventDefault();
        e.returnValue = 'You have an unsaved answer draft. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answerText, justEvaluatedFeedback]);

  // 3. Speech Recognition hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    interimTranscript,
    usedVoice,
    startListening,
    stopListening,
    resetVoiceTracking,
  } = useSpeechRecognition({
    onFinalTranscript: (transcriptChunk) => {
      setAnswerText((prev) => {
        const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        const updated = (prev + spacer + transcriptChunk).slice(0, 4000);
        if (currentQId && sessionId) {
          sessionStorage.setItem(`draft_answer_${sessionId}_${currentQId}`, updated);
        }
        return updated;
      });
    },
    onError: (msg) => {
      setVoiceToast(msg);
      setTimeout(() => setVoiceToast(null), 6000);
    },
  });

  // 4. Delivery stats (WPM and filler words "um", "uh", "like")
  const deliveryStats = useDeliveryStats(answerText, !justEvaluatedFeedback);

  // 5. Submit answer function
  const handleSubmitAnswer = async (isAutoSubmit: boolean = false) => {
    if (!sessionId || !currentQId) return;
    if (isSubmitting) return;

    // Stop active voice recognition
    stopListening();

    const finalAnswer = answerText.trim();
    // Non-auto submit requires non-empty answer
    if (!isAutoSubmit && !finalAnswer) return;

    setIsSubmitting(true);
    setNetworkError(null);

    const idempotencyKey = getIdempotencyKey(currentQId);

    try {
      const response = await submitAnswerMutation.mutateAsync({
        sessionId,
        questionId: currentQId,
        payload: {
          answer_text: finalAnswer,
          source: usedVoice ? 'voice' : 'typed',
        },
        idempotencyKey,
      });

      // Clear draft storage upon confirmed submission
      sessionStorage.removeItem(`draft_answer_${sessionId}_${currentQId}`);
      setJustEvaluatedFeedback(response);
      resetVoiceTracking();
    } catch (err: any) {
      // On network or submission error: DO NOT LOSE USER'S TEXT
      setNetworkError(err?.message || 'Network error occurred. Your answer is preserved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Bonus Countdown Timer
  const timerEnabled = Boolean(
    session?.timer_seconds &&
      currentQ &&
      currentQ.seconds_remaining !== null &&
      !justEvaluatedFeedback
  );

  const countdown = useCountdown({
    serverSecondsRemaining: currentQ?.seconds_remaining,
    totalSeconds: session?.timer_seconds ?? 60,
    enabled: timerEnabled && !isSubmitting,
    onExpire: () => {
      // Auto-submit whatever is typed exactly once
      handleSubmitAnswer(true);
    },
  });

  // 7. Autosize textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(140, textareaRef.current.scrollHeight)}px`;
    }
  }, [answerText, interimTranscript]);

  // Handle Ctrl+Enter submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isSubmitting && answerText.trim().length > 0) {
        handleSubmitAnswer(false);
      }
    }
  };

  // Retry evaluation action
  const handleRetryEval = async () => {
    if (!sessionId || !currentQId) return;
    try {
      const resp = await retryEvalMutation.mutateAsync({
        sessionId,
        questionId: currentQId,
      });
      setJustEvaluatedFeedback(resp);
    } catch (err: any) {
      setNetworkError(err?.message || 'Retry evaluation failed. Please try again.');
    }
  };

  // Next Question / Complete Session action
  const isLastQuestion = useMemo(() => {
    if (!session || !currentQ) return false;
    return currentQ.order_index >= session.num_questions;
  }, [session, currentQ]);

  const handleNextOrFinish = async () => {
    if (!sessionId) return;

    if (isLastQuestion) {
      try {
        await completeSessionMutation.mutateAsync(sessionId);
        navigate(`/summary/${sessionId}`);
      } catch (err: any) {
        setNetworkError(err?.message || 'Failed to complete session. Navigating to summary...');
        navigate(`/summary/${sessionId}`);
      }
    } else {
      // Clear current evaluated feedback and refetch session to advance
      setJustEvaluatedFeedback(null);
      setAnswerText('');
      await refetchSession();
    }
  };

  // Loading state
  if (isSessionLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-slate-800">Loading interview room...</h2>
        <p className="text-sm text-slate-500 mt-1">Restoring server-driven interview state</p>
      </div>
    );
  }

  // Error state
  if (sessionError || !session) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-white border border-red-200 shadow-sm text-center">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Unable to load session</h2>
        <p className="text-sm text-slate-600 mt-1">
          {sessionError?.message || 'Session not found or belongs to another user.'}
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

  // Preparing next question state
  if (isPreparingNext) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
            <Sparkles className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Preparing your next question...</h2>
          <p className="text-sm text-slate-500 mt-1">
            Analyzing your resume context and formulating tailored follow-ups.
          </p>
        </div>
        <button
          onClick={() => refetchSession()}
          className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
        >
          Check now
        </button>
      </div>
    );
  }

  // Active question details
  const orderIndex = currentQ?.order_index ?? 1;
  const totalQuestions = session.num_questions;
  const progressPercent = Math.min(100, Math.round(((orderIndex - 1) / totalQuestions) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Voice / Permission Toast Notification */}
      {voiceToast && (
        <div
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex items-center justify-between shadow-sm animate-fade-in"
          role="alert"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>{voiceToast}</span>
          </div>
          <button
            onClick={() => setVoiceToast(null)}
            className="text-xs text-amber-700 font-semibold hover:underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header: Progress and Timer */}
      <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Question {orderIndex} of {totalQuestions}
            </span>
            {currentQ?.category && (
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full capitalize">
                Category: {currentQ.category}
              </span>
            )}
          </div>

          {/* Bonus Timer */}
          {timerEnabled && (
            <CountdownTimer
              secondsRemaining={countdown.secondsRemaining}
              totalSeconds={countdown.totalSeconds}
              percentRemaining={countdown.percentRemaining}
              colorState={countdown.colorState}
              formattedTime={countdown.formattedTime}
            />
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-start space-x-3">
          <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 font-bold text-sm">
            Q{orderIndex}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
            {currentQ?.text || 'Loading question prompt...'}
          </h1>
        </div>
      </div>

      {/* Evaluating Skeleton / Loading Banner */}
      {isSubmitting && (
        <div
          className="bg-blue-50/70 border border-blue-200 rounded-2xl p-8 text-center space-y-3 animate-pulse"
          data-testid="evaluating-skeleton"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-100 text-blue-600 mb-1">
            <Sparkles className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-blue-950">Evaluating your answer...</h3>
          <p className="text-xs text-blue-700 max-w-md mx-auto">
            Our AI interviewer is scoring your relevance, technical depth, accuracy, and clarity.
          </p>
          <div className="flex justify-center space-x-2 pt-2">
            <div className="h-2 w-16 bg-blue-200 rounded-full animate-bounce" />
            <div className="h-2 w-16 bg-blue-200 rounded-full animate-bounce delay-100" />
            <div className="h-2 w-16 bg-blue-200 rounded-full animate-bounce delay-200" />
          </div>
        </div>
      )}

      {/* Feedback Card (if evaluated or failed) */}
      {justEvaluatedFeedback && !isSubmitting && (
        <FeedbackCard
          evalStatus={justEvaluatedFeedback.eval_status}
          score={justEvaluatedFeedback.score}
          dimensions={justEvaluatedFeedback.dimensions}
          strengths={justEvaluatedFeedback.strengths}
          improvements={justEvaluatedFeedback.improvements}
          missedPoints={justEvaluatedFeedback.missed_points}
          idealOutline={justEvaluatedFeedback.ideal_outline}
          isLastQuestion={isLastQuestion}
          isRetrying={retryEvalMutation.isPending}
          isCompleting={completeSessionMutation.isPending}
          onNextOrFinish={handleNextOrFinish}
          onRetryEval={handleRetryEval}
          onContinueAnyway={handleNextOrFinish}
        />
      )}

      {/* Answer Input Section (Hidden when feedback is visible) */}
      {!justEvaluatedFeedback && !isSubmitting && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="answer-input" className="text-sm font-bold text-slate-800">
              Your Answer
            </label>

            {/* Mic Button & Speech Controls */}
            <div className="flex items-center space-x-2">
              {isSpeechSupported ? (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  data-testid="voice-toggle-button"
                >
                  {isListening ? (
                    <>
                      <MicOff className="mr-1.5 h-3.5 w-3.5" />
                      Listening...
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                      Voice Answer
                    </>
                  )}
                </button>
              ) : (
                <span
                  className="text-[11px] text-slate-400 italic"
                  title="Voice works in Chrome/Edge; you can type instead"
                >
                  Voice works in Chrome/Edge; you can type instead
                </span>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              id="answer-input"
              ref={textareaRef}
              value={answerText}
              onChange={handleAnswerChange}
              onKeyDown={handleKeyDown}
              disabled={countdown.isExpired || isSubmitting}
              placeholder="Type your response here... (Press Ctrl+Enter to submit)"
              className="w-full min-h-[140px] p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 placeholder:text-slate-400 text-sm leading-relaxed resize-none transition disabled:bg-slate-50 disabled:text-slate-400"
              maxLength={4000}
              data-testid="answer-textarea"
            />

            {/* Interim Transcript Live Overlay */}
            {isListening && interimTranscript && (
              <div className="mt-1 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 italic animate-pulse">
                Speaking: "{interimTranscript}"
              </div>
            )}
          </div>

          {/* Delivery Stats Bar: Words, WPM, and Fillers */}
          <DeliveryStatsView stats={deliveryStats} />

          {/* Network Error Alert */}
          {networkError && (
            <div
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between"
              data-testid="network-error-banner"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span>{networkError} (Your text has been preserved)</span>
              </div>
              <button
                type="button"
                onClick={() => handleSubmitAnswer(false)}
                className="px-2.5 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-600 font-mono">Ctrl+Enter</kbd> to submit
            </span>

            <button
              type="button"
              onClick={() => handleSubmitAnswer(false)}
              disabled={isSubmitting || answerText.trim().length === 0}
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
              data-testid="submit-answer-button"
            >
              <Send className="mr-2 h-4 w-4" />
              Submit Answer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
