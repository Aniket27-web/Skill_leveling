import React, { Suspense, lazy, useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { AudioWaveform } from './components/AudioWaveform';
import { HunterStatusBar } from '../../components/HunterStatusBar';
import { applyQuestionResultToHunter, LevelDeltaCalculation } from '../../services/skillLeveling';

const AvatarStage = lazy(() => import('./components/AvatarStage').then((module) => ({ default: module.AvatarStage })));
type Viseme = 'neutral' | 'aa' | 'ee' | 'oh' | 'oo';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  PhoneCall,
  Video,
  Volume2,
  Camera,
  CameraOff,
  PhoneOff,
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

  const { data: meUser } = useQuery<{ id: string; name?: string; email?: string }>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      return res.ok ? res.json() : null;
    },
  });
  const candidateFirstName = meUser?.name ? meUser.name.trim().split(/\s+/)[0] : '';

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
  const [isDurationExpired, setIsDurationExpired] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [viseme, setViseme] = useState<Viseme>('neutral');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [hasJoinedVideoCall, setHasJoinedVideoCall] = useState(false);
  const [mediaSetupComplete, setMediaSetupComplete] = useState(false);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [interviewerResponse, setInterviewerResponse] = useState<string | null>(null);
  const [spokenText, setSpokenText] = useState<string>('');
  const [hasDeliveredIntro, setHasDeliveredIntro] = useState<boolean>(false);
  const [isAudibleConfirmed, setIsAudibleConfirmed] = useState<boolean>(false);
  const [justEvaluatedFeedback, setJustEvaluatedFeedback] = useState<any | null>(null);
  const [latestDelta, setLatestDelta] = useState<LevelDeltaCalculation | null>(null);

  // Cached idempotency keys per question id
  const idempotencyKeysRef = useRef<Record<string, string>>({});
  const durationCompletionRef = useRef(false);

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
    setInterviewerResponse(null);
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

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSpeechVoices(voices);
      setSelectedVoiceName((current) => {
        if (current && voices.some((voice) => voice.name === current)) return current;
        const saved = window.localStorage.getItem('interview_voice_name');
        if (saved && voices.some((voice) => voice.name === saved)) return saved;
        const preferred = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en') && !voice.lang.toLowerCase().includes('en-in')).sort((a, b) => {
          const score = (voice: SpeechSynthesisVoice) => {
            const lang = voice.lang.toLowerCase();
            const name = voice.name.toLowerCase();
            return (lang.startsWith('en-us') ? 100 : lang.startsWith('en-gb') ? 80 : lang.startsWith('en-au') ? 60 : lang.startsWith('en') ? 20 : 0)
              + (/natural|neural|google|microsoft|aria|jenny|samantha/.test(name) ? 25 : 0)
              - (lang.includes('en-in') || /india|ravi|heera/.test(name) ? 100 : 0);
          };
          return score(b) - score(a);
        })[0];
        if (preferred) window.localStorage.setItem('interview_voice_name', preferred.name);
        return preferred?.name || '';
      });
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const speakText = (text: string, listenAfter: boolean = false) => {
    if (!text.trim() || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpokenText(text);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = speechVoices.find((item) => item.name === selectedVoiceName);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsInterviewerSpeaking(true);
    utterance.onend = () => {
      setIsInterviewerSpeaking(false);
      setViseme('neutral');
      if (listenAfter && (session?.interview_mode === 'video' || session?.interview_mode === 'audio')) {
        startListening();
      }
    };
    utterance.onerror = () => { setIsInterviewerSpeaking(false); setViseme('neutral'); };
    utterance.onboundary = (event) => {
      const token = text.slice(event.charIndex, event.charIndex + 3).toLowerCase();
      setViseme(/[a]/.test(token) ? 'aa' : /[eiy]/.test(token) ? 'ee' : /[o]/.test(token) ? 'oh' : /[u]/.test(token) ? 'oo' : 'neutral');
    };
    window.speechSynthesis.speak(utterance);
  };

  const chooseVoice = (name: string) => {
    setSelectedVoiceName(name);
    window.localStorage.setItem('interview_voice_name', name);
  };

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
    setInterviewerResponse(null);

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
      setInterviewerResponse(response.interviewer_response || null);

      // Solo Leveling Hunter level calculation & penalty
      try {
        const { deltaInfo } = applyQuestionResultToHunter(response.score, session?.difficulty || 'medium');
        setLatestDelta(deltaInfo);
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Failed to update hunter profile', e);
      }

      if (session?.interview_mode !== 'text' && response.interviewer_response) speakText(response.interviewer_response);
      resetVoiceTracking();
    } catch (err: any) {
      // On network or submission error: DO NOT LOSE USER'S TEXT
      setNetworkError(err?.message || 'Network error occurred. Your answer is preserved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // In video interviews, submit after five seconds without new speech activity.
  useEffect(() => {
    if (
      session?.interview_mode !== 'video' ||
      !hasJoinedVideoCall ||
      !microphoneEnabled ||
      isInterviewerSpeaking ||
      isSubmitting ||
      justEvaluatedFeedback ||
      !answerText.trim()
    ) return;

    const silenceTimer = window.setTimeout(() => {
      void handleSubmitAnswer(false);
    }, 5000);
    return () => window.clearTimeout(silenceTimer);
  }, [session?.interview_mode, hasJoinedVideoCall, microphoneEnabled, isInterviewerSpeaking, isSubmitting, justEvaluatedFeedback, answerText, interimTranscript]);

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

  const durationTotalSeconds = (session?.duration_minutes || 0) * 60;
  const durationRemaining = session?.duration_minutes && session.created_at
    ? Math.max(0, durationTotalSeconds - Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000))
    : null;
  const durationCountdown = useCountdown({
    serverSecondsRemaining: durationRemaining,
    totalSeconds: durationTotalSeconds || 60,
    enabled: Boolean(session?.status === 'in_progress' && session.duration_minutes),
    onExpire: () => {
      if (durationCompletionRef.current || !sessionId || completeSessionMutation.isPending) return;
      durationCompletionRef.current = true;
      setIsDurationExpired(true);
      stopListening();
      void completeSessionMutation.mutateAsync(sessionId).catch(() => undefined).finally(() => navigate(`/summary/${sessionId}`, { replace: true }));
    },
  });
  useEffect(() => {
    if (!session?.duration_minutes || durationRemaining !== 0 || durationCompletionRef.current || !sessionId) return;
    durationCompletionRef.current = true;
    setIsDurationExpired(true);
    stopListening();
    void completeSessionMutation.mutateAsync(sessionId).catch(() => undefined).finally(() => navigate(`/summary/${sessionId}`, { replace: true }));
  }, [durationRemaining, session?.duration_minutes, sessionId, stopListening, completeSessionMutation, navigate]);

  // 7. Autosize textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(140, textareaRef.current.scrollHeight)}px`;
    }
  }, [answerText, interimTranscript]);

  const getTimeBasedGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const speakQuestion = (forceFullIntro: boolean = false) => {
    if (!currentQ?.text || !('speechSynthesis' in window)) {
      setVoiceToast('Question audio is not supported by this browser.');
      return;
    }

    const order = currentQ?.order_index ?? 1;
    let spokenSentence = currentQ.text;

    if ((order === 1 && !hasDeliveredIntro) || forceFullIntro) {
      const greeting = getTimeBasedGreeting();
      const namePart = candidateFirstName ? ` ${candidateFirstName}` : '';
      spokenSentence = `Hello${namePart}! ${greeting}. Can you hear me clearly? Am I audible? I am your personal AI technical interviewer today. Welcome to your mock interview! We will walk through questions based on your background and projects. Take your time, think out loud, and answer naturally. Let's start with our first question: ${currentQ.text}`;
      setHasDeliveredIntro(true);
    } else if (order > 1) {
      spokenSentence = `Thank you. Let's move on to question ${order}: ${currentQ.text}`;
    }

    speakText(spokenSentence, true);
  };

  useEffect(() => {
    if (session?.status !== 'in_progress' || session?.interview_mode === 'text' || !currentQ?.text || !('speechSynthesis' in window)) return;
    if (session.interview_mode === 'video' && !hasJoinedVideoCall) return;
    speakQuestion();
    return () => window.speechSynthesis.cancel();
  }, [session?.interview_mode, session?.status, currentQ?.id, hasJoinedVideoCall]);

  useEffect(() => {
    if (session?.status === 'in_progress' && session.interview_mode === 'video' && hasJoinedVideoCall && microphoneEnabled && !('speechSynthesis' in window) && !isListening) {
      startListening();
    }
  }, [session?.status, session?.interview_mode, hasJoinedVideoCall, microphoneEnabled, isListening, startListening]);

  useEffect(() => {
    if (session?.status !== 'in_progress' || session?.interview_mode !== 'video') return;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraEnabled(false);
      setMicrophoneEnabled(false);
      setMediaSetupComplete(true);
      setVoiceToast('Camera preview requires a browser with camera support on HTTPS or localhost.');
      return;
    }
    setMediaSetupComplete(false);
    let mediaRequestsRemaining = 2;
    const finishMediaSetup = () => {
      mediaRequestsRemaining -= 1;
      if (mediaRequestsRemaining === 0 && !cancelled) setMediaSetupComplete(true);
    };
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((cameraStream) => {
        if (cancelled) {
          cameraStream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = cameraStream;
        setCameraEnabled(true);
        if (cameraRef.current) cameraRef.current.srcObject = cameraStream;
      })
      .catch(() => {
        setCameraEnabled(false);
        setVoiceToast('Camera access was not granted. You can still join with your camera off.');
      })
      .finally(finishMediaSetup);
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      .then((microphoneStream) => {
        if (cancelled) {
          microphoneStream.getTracks().forEach((track) => track.stop());
          return;
        }
        microphoneStreamRef.current = microphoneStream;
        setMicrophoneEnabled(true);
      })
      .catch(() => {
        setMicrophoneEnabled(false);
        setVoiceToast('Microphone access was not granted. Turn on your microphone before joining to answer by voice.');
      })
      .finally(finishMediaSetup);
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
      if (cameraRef.current) cameraRef.current.srcObject = null;
    };
  }, [session?.interview_mode]);

  useEffect(() => {
    if (cameraEnabled && cameraRef.current && cameraStreamRef.current) {
      cameraRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraEnabled, hasJoinedVideoCall]);

  const toggleCamera = async () => {
    if (cameraEnabled) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraRef.current) cameraRef.current.srcObject = null;
      setCameraEnabled(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera support requires HTTPS or localhost.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;
      if (cameraRef.current) cameraRef.current.srcObject = stream;
      setCameraEnabled(true);
      setVoiceToast(null);
    } catch {
      setCameraEnabled(false);
      setVoiceToast('Camera access was not granted. You can still answer with voice or text.');
    }
  };

  const toggleMicrophone = async () => {
    if (microphoneEnabled) {
      microphoneStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
      stopListening();
      setMicrophoneEnabled(false);
      return;
    }
    try {
      let stream = microphoneStreamRef.current;
      if (!stream || stream.getAudioTracks().every((track) => track.readyState === 'ended')) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable.');
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        microphoneStreamRef.current = stream;
      }
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      setMicrophoneEnabled(true);
      setVoiceToast(null);
      if (hasJoinedVideoCall && !isInterviewerSpeaking) startListening();
    } catch {
      setMicrophoneEnabled(false);
      setVoiceToast('Microphone access was not granted. Check browser permissions and try again.');
    }
  };

  const handleEndVideoCall = async () => {
    if (!sessionId) return;
    const hasUnsubmittedAnswer = Boolean(answerText.trim() && !justEvaluatedFeedback);
    const message = hasUnsubmittedAnswer
      ? 'End this interview? Your unsent answer will be lost, and unanswered questions will score zero.'
      : 'End this interview and open your summary?';
    if (!window.confirm(message)) return;
    stopListening();
    try {
      await completeSessionMutation.mutateAsync(sessionId);
    } catch (err: any) {
      setNetworkError(err?.message || 'Could not finish the session. Opening the summary with saved progress.');
    } finally {
      navigate(`/summary/${sessionId}`);
    }
  };

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
      try {
        const { deltaInfo } = applyQuestionResultToHunter(resp.score, session?.difficulty || 'medium');
        setLatestDelta(deltaInfo);
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Failed to update hunter profile', e);
      }
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
      setLatestDelta(null);
      setAnswerText('');
      await refetchSession();
    }
  };

  // Loading state
  if (isSessionLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-10 w-10 text-purple-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-purple-200">Loading interview room...</h2>
        <p className="text-sm text-slate-500 dark:text-purple-400/70 mt-1">Awakening hunter session & technical dungeon state</p>
      </div>
    );
  }

  // Error state
  if (sessionError || !session) {
    const isAuthError =
      sessionError?.message?.toLowerCase().includes('authenticated') ||
      sessionError?.message?.toLowerCase().includes('unauthorized');

    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white dark:bg-[#0d071a] border border-purple-200 dark:border-purple-900/60 shadow-xl text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {isAuthError ? 'Hunter Authorization Required' : 'Unable to load session'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-purple-300/80 mt-1">
          {isAuthError
            ? 'You must be logged in to enter this dungeon session. Please return to the portal to sign in.'
            : (sessionError?.message || 'Session not found or belongs to another user.')}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 text-white text-sm font-bold shadow-[0_0_15px_rgba(147,51,234,0.4)] hover:from-purple-600 hover:to-indigo-500 transition"
        >
          {isAuthError ? 'Return to Portal & Awaken' : 'Return to Dashboard'}
        </button>
      </div>
    );
  }

  // Preparing next question state
  if (isPreparingNext) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center animate-pulse">
            <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Preparing your next dungeon challenge...</h2>
          <p className="text-sm text-slate-500 dark:text-purple-300/70 mt-1">
            Analyzing your resume context and formulating tailored follow-ups.
          </p>
        </div>
        <button
          onClick={() => refetchSession()}
          className="mt-2 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
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

  if (session.interview_mode === 'video' && !hasJoinedVideoCall) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#202124] px-4 py-8 text-white sm:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-center justify-between">
            <div><p className="text-lg font-semibold">Interview Coach</p><p className="text-sm text-white/60">Video interview · Question {orderIndex} of {totalQuestions}</p></div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">Ready to join?</span>
          </header>
          <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#111214] shadow-2xl ring-1 ring-white/10">
              {cameraEnabled
                ? <video ref={cameraRef} autoPlay muted playsInline aria-label="Camera preview" className="h-full w-full scale-x-[-1] object-cover" />
                : <div className="flex h-full flex-col items-center justify-center gap-3 text-white/65"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500 text-2xl font-semibold">You</span><span>Camera is off</span></div>}
              <div className="absolute bottom-4 left-4 rounded-md bg-black/45 px-3 py-1.5 text-sm">Your camera preview</div>
            </div>
            <section className="space-y-5">
              <div><h1 className="text-2xl font-semibold">Check your setup</h1><p className="mt-2 text-sm leading-6 text-white/65">Turn on your camera and microphone, then join when you’re ready. Your answers will be captured by voice.</p></div>
              <div className="flex gap-3">
                <button type="button" onClick={toggleMicrophone} aria-pressed={microphoneEnabled} className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium ${microphoneEnabled ? 'bg-[#3c4043] hover:bg-[#4b4f52]' : 'bg-rose-600 hover:bg-rose-700'}`}>{microphoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}{microphoneEnabled ? 'Microphone on' : 'Microphone off'}</button>
                <button type="button" onClick={toggleCamera} aria-pressed={cameraEnabled} className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium ${cameraEnabled ? 'bg-[#3c4043] hover:bg-[#4b4f52]' : 'bg-rose-600 hover:bg-rose-700'}`}>{cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}{cameraEnabled ? 'Camera on' : 'Camera off'}</button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><label htmlFor="interviewer-voice" className="block text-xs font-medium text-white/65">Interviewer voice</label><button type="button" onClick={() => speakText('Hello, I will be conducting your interview today. Take your time and answer in your own words.')} disabled={!speechVoices.length} className="text-xs font-medium text-[#aecbfa] hover:text-white disabled:opacity-40">Preview voice</button></div>
                <select id="interviewer-voice" value={selectedVoiceName} onChange={(event) => chooseVoice(event.target.value)} disabled={!speechVoices.length} className="w-full rounded-xl border border-white/15 bg-[#303134] px-3 py-3 text-sm text-white outline-none focus:border-[#8ab4f8] disabled:opacity-60">
                  {speechVoices.some((voice) => voice.lang.toLowerCase().startsWith('en') && !voice.lang.toLowerCase().includes('en-in'))
                    ? speechVoices.filter((voice) => voice.lang.toLowerCase().startsWith('en') && !voice.lang.toLowerCase().includes('en-in')).map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)
                    : <option value="">No US/UK English voice installed</option>}
                </select>
                <p className="text-xs text-white/45">Choose an English voice from your browser. US and UK voices are preferred; available voice quality depends on your browser and operating system.</p>
              </div>
              {voiceToast && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{voiceToast}</p>}
              {!isSpeechSupported && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">Voice answers need speech recognition. Open this interview in Chrome or Edge to join.</p>}
              <button type="button" onClick={() => { setVoiceToast(null); setHasJoinedVideoCall(true); }} disabled={!mediaSetupComplete || !microphoneEnabled || !isSpeechSupported || !currentQ} className="w-full rounded-full bg-[#8ab4f8] px-6 py-3.5 font-semibold text-[#202124] transition hover:bg-[#aecbfa] disabled:cursor-not-allowed disabled:opacity-40">{mediaSetupComplete ? 'Join interview' : 'Checking camera and microphone…'}</button>
              <p className="text-center text-xs text-white/45">Microphone is required for voice-only interview answers.</p>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={`${session.interview_mode === 'video' ? 'mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6' : 'mx-auto max-w-4xl space-y-6 px-4 py-8'}`}>
      {/* Solo Leveling Hunter Status Bar */}
      <HunterStatusBar />

      {/* Voice / Permission Toast Notification */}
      {voiceToast && (
        <div
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-sm flex items-center justify-between shadow-sm animate-fade-in"
          role="alert"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>{voiceToast}</span>
          </div>
          <button
            onClick={() => setVoiceToast(null)}
            className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header: Progress and Timer */}
      <div className={`space-y-3 rounded-2xl border p-5 shadow-sm ${session.interview_mode === 'video' ? 'border-slate-700 bg-[#202124] text-white' : 'border-purple-200 bg-white dark:border-purple-900/60 dark:bg-[#0d071a]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${session.interview_mode === 'video' ? 'border-white/15 bg-white/10 text-white' : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300'}`}>
              Question {orderIndex} of {totalQuestions}
            </span>
            {currentQ?.category && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${session.interview_mode === 'video' ? 'bg-white/10 text-white/75' : 'bg-slate-100 text-slate-600 dark:bg-[#180e30] dark:text-purple-300'}`}>
                Category: {currentQ.category}
              </span>
            )}
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 dark:border dark:border-purple-800 hidden sm:inline-block">
              {session.difficulty} Dungeon
            </span>
          </div>

          {/* Bonus Timer */}
          <div className="flex items-center gap-3">
          {session.duration_minutes && (
            <CountdownTimer
              secondsRemaining={durationCountdown.secondsRemaining}
              totalSeconds={durationCountdown.totalSeconds}
              percentRemaining={durationCountdown.percentRemaining}
              colorState={durationCountdown.colorState}
              formattedTime={durationCountdown.formattedTime}
            />
          )}
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
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-purple-100 dark:bg-purple-950/80 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(147,51,234,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isDurationExpired && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Your dungeon time is up. We are finalizing your hunter debrief.</div>}

      {/* Question Card */}
      {session.interview_mode !== 'video' && <div className="space-y-4 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center flex-shrink-0 font-bold text-sm font-mono border border-purple-200 dark:border-purple-800">Q{orderIndex}</div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">{currentQ?.text || 'Formulating dungeon challenge prompt...'}</h1>
          </div>
          {session.interview_mode !== 'text' && <button type="button" onClick={() => speakQuestion(false)} aria-label="Read question aloud" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"><Volume2 className="h-4 w-4" /> Play question</button>}
        </div>
      </div>}

      {session.interview_mode === 'audio' && <section className="grid gap-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-[#0d071a] p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div>
          <div className="mb-3 flex items-start gap-3">
            <div className="rounded-xl bg-purple-100 dark:bg-purple-950 p-2.5 text-purple-700 dark:text-purple-300">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Live Audio Technical Interview
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Call
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-purple-300/70">
                Your AI interviewer speaks the questions aloud. Use your voice to answer naturally.
              </p>
            </div>
          </div>

          {/* Interactive Audible Check Banner */}
          {orderIndex === 1 && !isAudibleConfirmed && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2.5 text-xs text-purple-900 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-200">
              <span className="font-medium">🎙️ Interviewer: "Can you hear me clearly? Am I audible?"</span>
              <button
                type="button"
                onClick={() => setIsAudibleConfirmed(true)}
                className="rounded-lg bg-purple-700 px-3 py-1 font-bold text-white hover:bg-purple-600 transition ml-2 shrink-0 shadow-sm"
              >
                Yes, audible! ✓
              </button>
            </div>
          )}

          {/* Interviewer Spoken Dialogue / Live Candidate Transcription */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 text-xs dark:border-purple-900/50 dark:bg-[#120a24]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
              {isInterviewerSpeaking ? '🎙️ AI Interviewer Speaking...' : isListening ? '🗣️ Candidate Speaking (Transcribing)...' : '📋 Active Discussion'}
            </p>
            <p className="text-slate-800 dark:text-purple-200 leading-relaxed font-sans text-sm">
              {isInterviewerSpeaking ? (spokenText || currentQ?.text) : isListening ? (interimTranscript || answerText || 'Listening to your answer...') : (currentQ?.text || 'Waiting for next question...')}
            </p>
          </div>

          <div className="mt-3">
            <AudioWaveform active={isListening} />
          </div>
        </div>
        <Suspense fallback={<div className="h-[360px] animate-pulse rounded-2xl bg-slate-900 sm:h-[480px]" aria-label="Loading interviewer avatar" />}>
          <AvatarStage speaking={isInterviewerSpeaking} listening={isListening} viseme={viseme} />
        </Suspense>
      </section>}

      {session.interview_mode === 'video' && <section className="overflow-hidden rounded-3xl border border-slate-700 bg-[#202124] shadow-2xl" aria-label="Video interview room">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white sm:px-6">
          <div><p className="text-sm font-semibold">Personal AI Interviewer</p><p className="text-xs text-white/55">Live interactive video interview · Question {orderIndex} of {totalQuestions}</p></div>
          <div className="flex items-center gap-2 text-xs text-white/70"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live Call Connected</div>
        </div>
        <div className="relative mx-auto h-[min(64vh,680px)] min-h-[380px] max-h-[680px] overflow-hidden bg-[#111214] sm:min-h-[460px]">
          <Suspense fallback={<div className="h-full min-h-[380px] animate-pulse bg-slate-900 sm:min-h-[460px]" aria-label="Loading interviewer" />}>
            <AvatarStage className="h-full min-h-[380px] rounded-none sm:min-h-[460px]" speaking={isInterviewerSpeaking} listening={isListening} viseme={viseme} />
          </Suspense>

          {/* Audible Check Pill in Video View */}
          {orderIndex === 1 && !isAudibleConfirmed && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-purple-950/90 border border-purple-500/70 px-4 py-1.5 text-xs text-white shadow-2xl backdrop-blur-md">
              <span className="font-mono text-purple-300 font-bold">🎙️ Interviewer: "Am I audible?"</span>
              <button
                type="button"
                onClick={() => setIsAudibleConfirmed(true)}
                className="rounded-full bg-emerald-500 hover:bg-emerald-400 px-3 py-0.5 text-[11px] font-bold text-slate-950 transition shadow"
              >
                Yes, I hear you! ✓
              </button>
            </div>
          )}

          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-5 pt-16 text-center text-white sm:bottom-12 sm:px-8">
            <p className="max-w-3xl rounded-xl bg-black/60 px-5 py-3 text-base font-medium leading-relaxed shadow-xl sm:text-lg border border-white/10 backdrop-blur-md">
              {isInterviewerSpeaking
                ? (spokenText || interviewerResponse || currentQ?.text)
                : isListening
                ? `🗣️ You: ${interimTranscript || answerText || 'Listening to your response...'}`
                : (currentQ?.text || 'Preparing next challenge…')}
            </p>
          </div>
          <div className="absolute right-3 top-3 h-28 w-40 overflow-hidden rounded-2xl border border-white/20 bg-[#3c4043] shadow-xl sm:right-5 sm:top-5 sm:h-40 sm:w-56">
            {cameraEnabled ? <video ref={cameraRef} autoPlay muted playsInline aria-label="Your local camera preview" className="h-full w-full scale-x-[-1] object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-lg font-semibold">You</span><span className="text-xs">Camera off</span></div>}
            <span className="absolute bottom-2 left-2 rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium text-white">You</span>
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white sm:left-5 sm:top-5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> AI interviewer</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 px-3 py-4 sm:gap-5 sm:px-6">
          <button type="button" onClick={toggleMicrophone} aria-pressed={microphoneEnabled} aria-label={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'} title={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${microphoneEnabled ? 'bg-[#3c4043] text-white hover:bg-[#4b4f52]' : 'bg-rose-600 text-white'}`}>{microphoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
          <button type="button" onClick={toggleCamera} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${cameraEnabled ? 'bg-[#3c4043] text-white hover:bg-[#4b4f52]' : 'bg-rose-600 text-white'}`}>{cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</button>
          <button type="button" onClick={() => speakText(`Here is question ${orderIndex} again: ${currentQ?.text}`, true)} aria-label="Repeat question aloud" title="Repeat question" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3c4043] text-white transition hover:bg-[#4b4f52]"><Volume2 className="h-5 w-5" /></button>
          <button type="button" onClick={handleEndVideoCall} disabled={completeSessionMutation.isPending} aria-label="End interview" title="End interview" className="flex h-12 min-w-16 items-center justify-center rounded-full bg-rose-600 px-5 text-white transition hover:bg-rose-700 disabled:opacity-50"><PhoneOff className="h-5 w-5" /></button>
          {!justEvaluatedFeedback && <button type="button" onClick={() => handleSubmitAnswer(false)} disabled={!answerText.trim() || isSubmitting || !microphoneEnabled} className="flex h-12 items-center gap-2 rounded-full bg-[#8ab4f8] px-5 text-sm font-semibold text-[#202124] hover:bg-[#aecbfa] disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /> Submit answer</button>}
          {isListening && <div className="basis-full"><AudioWaveform active barCount={24} /></div>}
          <p className="basis-full text-center text-xs text-white/55" aria-live="polite">{isListening ? 'Listening to your answer…' : isInterviewerSpeaking ? 'Interviewer is speaking…' : justEvaluatedFeedback ? 'Answer submitted' : 'Your spoken answer is being transcribed for feedback'}</p>
        </div>
      </section>}

      {session.interview_mode === 'video' && networkError && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-300/30 bg-rose-950/70 p-4 text-sm text-rose-100">
          <span>{networkError} Your spoken answer is still available to retry.</span>
          <button type="button" onClick={() => handleSubmitAnswer(false)} disabled={isSubmitting || !answerText.trim()} className="shrink-0 rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white hover:bg-rose-500 disabled:opacity-50">Retry</button>
        </div>
      )}

      {/* Evaluating Skeleton / Loading Banner */}
      {isSubmitting && (
        <div
          className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-2xl p-8 text-center space-y-3 animate-pulse shadow-[0_0_20px_rgba(147,51,234,0.15)]"
          data-testid="evaluating-skeleton"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 mb-1">
            <Sparkles className="h-6 w-6 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-purple-100">Evaluating your answer...</h3>
          <p className="text-xs text-purple-700 dark:text-purple-300/80 max-w-md mx-auto">
            System AI is measuring technical depth, relevance, accuracy, and clarity. Hunter level adjustment pending.
          </p>
          <div className="flex justify-center space-x-2 pt-2">
            <div className="h-2 w-16 bg-purple-300 dark:bg-purple-700 rounded-full animate-bounce" />
            <div className="h-2 w-16 bg-purple-300 dark:bg-purple-700 rounded-full animate-bounce delay-100" />
            <div className="h-2 w-16 bg-purple-300 dark:bg-purple-700 rounded-full animate-bounce delay-200" />
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
          deltaInfo={latestDelta}
          onNextOrFinish={handleNextOrFinish}
          onRetryEval={handleRetryEval}
          onContinueAnyway={handleNextOrFinish}
        />
      )}

      {/* Answer Input Section (Hidden when feedback is visible) */}
      {session.interview_mode !== 'video' && !justEvaluatedFeedback && !isSubmitting && (
        <div className="bg-white dark:bg-[#0d071a] p-6 rounded-2xl border border-purple-200 dark:border-purple-900/60 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="answer-input" className="text-sm font-bold text-slate-800 dark:text-purple-200">
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
                      : 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900'
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
                      <Mic className="mr-1.5 h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      Voice Answer
                    </>
                  )}
                </button>
              ) : (
                <span
                  className="text-[11px] text-slate-400 dark:text-purple-400/60 italic"
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
              className="w-full min-h-[140px] p-4 rounded-xl border border-slate-200 dark:border-purple-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 outline-none text-slate-900 dark:text-purple-100 placeholder:text-slate-400 dark:placeholder:text-purple-400/40 text-sm leading-relaxed resize-none transition bg-white dark:bg-[#140b27] disabled:bg-slate-50 disabled:text-slate-400"
              maxLength={4000}
              data-testid="answer-textarea"
            />

            {/* Interim Transcript Live Overlay */}
            {isListening && interimTranscript && (
              <div className="mt-1 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-300 italic animate-pulse">
                Speaking: "{interimTranscript}"
              </div>
            )}
          </div>

          {/* Delivery Stats Bar: Words, WPM, and Fillers */}
          <DeliveryStatsView stats={deliveryStats} />

          {/* Network Error Alert */}
          {networkError && (
            <div
              className="p-3.5 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-900 dark:text-rose-200 text-xs flex items-center justify-between"
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
            <span className="text-xs text-slate-400 dark:text-purple-400/60 hidden sm:inline font-mono">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-purple-950 border dark:border-purple-800 text-slate-600 dark:text-purple-300 font-mono">Ctrl+Enter</kbd> to submit
            </span>

            <button
              type="button"
              onClick={() => handleSubmitAnswer(false)}
              disabled={isSubmitting || answerText.trim().length === 0}
              className="inline-flex items-center px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(147,51,234,0.4)] transition disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
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

