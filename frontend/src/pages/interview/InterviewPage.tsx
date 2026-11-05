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
import logoImg from '../../assests/logo/Skill Leveling Growth Emblem.png';

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
  Maximize2,
  Minimize2,
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

  // Active question details & indexing (handles both 0-indexed database and 1-indexed fixtures)
  const isZeroIndexed = useMemo(() => {
    if (!session?.questions?.length) return false;
    return session.questions[0].order_index === 0;
  }, [session?.questions]);

  const orderIndex = useMemo(() => {
    if (!currentQ) return 1;
    return isZeroIndexed ? currentQ.order_index + 1 : currentQ.order_index;
  }, [currentQ, isZeroIndexed]);

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
  const [activeSubtitleLine, setActiveSubtitleLine] = useState<string>('');
  const [isFullscreenVideo, setIsFullscreenVideo] = useState<boolean>(true);
  const sentenceRangesRef = useRef<{ text: string; start: number; end: number }[]>([]);
  const subtitleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasDeliveredIntroRef = useRef<boolean>(false);
  const lastSpokenQuestionIdRef = useRef<string | null>(null);
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

  // Reset introductory greeting flag when switching sessions
  useEffect(() => {
    hasDeliveredIntroRef.current = false;
    lastSpokenQuestionIdRef.current = null;
  }, [sessionId]);

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
    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }
    setSpokenText(text);

    // Compute sentence ranges for line-by-line streaming subtitles
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text.trim()];
    let cursor = 0;
    const ranges = sentences.map((sentence) => {
      const start = text.indexOf(sentence, cursor);
      const end = start >= 0 ? start + sentence.length : cursor + sentence.length;
      cursor = end;
      return { text: sentence, start: Math.max(0, start), end };
    });
    sentenceRangesRef.current = ranges;
    if (ranges.length > 0) {
      setActiveSubtitleLine(ranges[0].text);
    }

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
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
        subtitleTimerRef.current = null;
      }
      setIsInterviewerSpeaking(false);
      setViseme('neutral');
      setTimeout(() => {
        setActiveSubtitleLine('');
      }, 1600);
      if (listenAfter && (session?.interview_mode === 'video' || session?.interview_mode === 'audio')) {
        startListening();
      }
    };
    utterance.onerror = () => {
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
        subtitleTimerRef.current = null;
      }
      setIsInterviewerSpeaking(false);
      setViseme('neutral');
    };
    utterance.onboundary = (event) => {
      const token = text.slice(event.charIndex, event.charIndex + 3).toLowerCase();
      setViseme(/[a]/.test(token) ? 'aa' : /[eiy]/.test(token) ? 'ee' : /[o]/.test(token) ? 'oh' : /[u]/.test(token) ? 'oo' : 'neutral');

      if (event.charIndex !== undefined && sentenceRangesRef.current.length > 0) {
        const active = sentenceRangesRef.current.find(
          (r) => event.charIndex >= r.start && event.charIndex <= r.end
        );
        if (active && active.text) {
          setActiveSubtitleLine(active.text);
        }
      }
    };

    // Fallback cadence timer in case browser boundary events are irregular
    if (ranges.length > 1) {
      let idx = 0;
      const stepSentence = () => {
        idx++;
        if (idx < ranges.length) {
          setActiveSubtitleLine(ranges[idx].text);
          const wordCount = ranges[idx].text.split(/\s+/).length;
          const waitMs = Math.max(2200, (wordCount / 2.7) * 1000);
          subtitleTimerRef.current = setTimeout(stepSentence, waitMs);
        }
      };
      const firstWordCount = ranges[0].text.split(/\s+/).length;
      subtitleTimerRef.current = setTimeout(stepSentence, Math.max(2200, (firstWordCount / 2.7) * 1000));
    }

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

      // Skill Leveling Hunter level calculation & penalty
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

    let spokenSentence = currentQ.text;

    if (!hasDeliveredIntroRef.current || forceFullIntro || orderIndex === 1) {
      hasDeliveredIntroRef.current = true;
      const greeting = getTimeBasedGreeting();
      const namePart = candidateFirstName ? ` ${candidateFirstName}` : '';
      spokenSentence = `Hello${namePart}, ${greeting}! Welcome to your technical interview. I'm Marcus, and I will be conducting your session today. We will walk through questions based on your technical background and experience. Take your time, think through your solutions out loud, and speak naturally whenever you're ready. To begin, here is our first question: ${currentQ.text}`;
    } else {
      spokenSentence = `Thank you. Let's move on to question ${orderIndex}: ${currentQ.text}`;
    }

    if (currentQ?.id) {
      lastSpokenQuestionIdRef.current = currentQ.id;
    }
    speakText(spokenSentence, true);
  };

  useEffect(() => {
    if (session?.status !== 'in_progress' || session?.interview_mode === 'text' || !currentQ?.id || !currentQ?.text || !('speechSynthesis' in window)) return;
    if (session.interview_mode === 'video' && !hasJoinedVideoCall) return;
    if (lastSpokenQuestionIdRef.current === currentQ.id) return;

    // Small delay ensures video and audio stream initialize smoothly in sequence
    const timer = window.setTimeout(() => {
      speakQuestion();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
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
    return orderIndex >= session.num_questions;
  }, [session, currentQ, orderIndex]);

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
  const totalQuestions = session.num_questions;
  const progressPercent = Math.min(100, Math.round(((orderIndex - 1) / totalQuestions) * 100));

  if (session.interview_mode === 'video' && !hasJoinedVideoCall) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
        {/* Hunter Status Bar */}
        <HunterStatusBar />

        {/* Top Header Card */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center rounded-3xl border border-purple-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-purple-900/60 dark:bg-[#0d071a]">
          <div className="flex items-center gap-4">
            <img
              src={logoImg}
              alt="Skill Leveling Emblem"
              className="h-14 w-14 object-contain drop-shadow-[0_0_15px_rgba(147,51,234,0.5)] shrink-0 hidden sm:block"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] font-mono text-purple-700 bg-purple-100 dark:bg-purple-950/80 dark:border dark:border-purple-800 dark:text-purple-300 px-2.5 py-0.5 rounded-full">
                  Gate Arena Calibration
                </span>
                <span className="text-xs font-mono text-purple-600 dark:text-purple-400">
                  Question {orderIndex} of {totalQuestions} · {session.difficulty} Dungeon
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Video Interview Setup & Calibration
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-purple-300/80">
                Calibrate your camera, microphone, and synthetic interviewer voice before entering the arena.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 px-4 py-2.5 text-xs font-bold text-purple-700 dark:text-purple-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span>Ready to Awaken</span>
          </div>
        </div>

        {/* 2-Column Calibration Layout */}
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* Camera Preview Card */}
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0d071a] shadow-2xl flex flex-col justify-between">
            {cameraEnabled ? (
              <video
                ref={cameraRef}
                autoPlay
                muted
                playsInline
                aria-label="Camera preview"
                className="h-full w-full scale-x-[-1] object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-purple-300/70 p-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-950/80 border border-purple-500/40 text-purple-300 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                  <CameraOff className="h-9 w-9 text-purple-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Camera Preview Disabled</p>
                  <p className="text-xs text-purple-300/60 mt-0.5">Toggle camera below to inspect your video feed.</p>
                </div>
              </div>
            )}

            {/* Top Tag */}
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 border border-purple-500/30 px-3.5 py-1.5 text-xs text-white backdrop-blur-md shadow-lg">
              <span className={`h-2 w-2 rounded-full ${cameraEnabled ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'}`} />
              <span className="font-mono">{cameraEnabled ? 'Live Video Active' : 'Camera Standby'}</span>
            </div>

            {/* Bottom Tag */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-black/60 border border-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-md">
              <span className="font-semibold text-purple-200">{candidateFirstName || 'Candidate'}</span>
              <span className="text-[11px] text-white/50 font-mono">· 1080p Stream</span>
            </div>
          </div>

          {/* Device Controls & Voice Settings Card */}
          <section className="rounded-3xl border border-purple-200/80 bg-white/80 p-6 sm:p-7 shadow-xl backdrop-blur-md dark:border-purple-900/60 dark:bg-[#0d071a] flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div className="border-b border-purple-100 dark:border-purple-900/50 pb-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Hardware & Audio Check
                </h2>
                <p className="text-xs text-slate-500 dark:text-purple-300/70 mt-0.5">
                  Ensure your devices are responsive before entering the video dungeon.
                </p>
              </div>

              {/* Mic & Camera Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  aria-pressed={microphoneEnabled}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-xs font-bold transition-all shadow-sm ${
                    microphoneEnabled
                      ? 'border border-purple-400 bg-purple-50 text-purple-900 dark:border-purple-600 dark:bg-purple-950/70 dark:text-purple-200 shadow-[0_0_15px_rgba(147,51,234,0.15)]'
                      : 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${microphoneEnabled ? 'bg-purple-200 dark:bg-purple-900/80 text-purple-700 dark:text-purple-200' : 'bg-rose-200 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200'}`}>
                    {microphoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </div>
                  <span>{microphoneEnabled ? 'Microphone Active' : 'Microphone Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-pressed={cameraEnabled}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-xs font-bold transition-all shadow-sm ${
                    cameraEnabled
                      ? 'border border-purple-400 bg-purple-50 text-purple-900 dark:border-purple-600 dark:bg-purple-950/70 dark:text-purple-200 shadow-[0_0_15px_rgba(147,51,234,0.15)]'
                      : 'border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${cameraEnabled ? 'bg-purple-200 dark:bg-purple-900/80 text-purple-700 dark:text-purple-200' : 'bg-rose-200 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200'}`}>
                    {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                  </div>
                  <span>{cameraEnabled ? 'Camera Active' : 'Camera Off'}</span>
                </button>
              </div>

              {/* Voice Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="interviewer-voice" className="block text-xs font-bold text-slate-800 dark:text-purple-200">
                    Interviewer Voice Synthesis
                  </label>
                  <button
                    type="button"
                    onClick={() => speakText('Hello, I will be conducting your technical interview today. Take your time and answer naturally.')}
                    disabled={!speechVoices.length}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-40 transition"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Preview Voice
                  </button>
                </div>
                <select
                  id="interviewer-voice"
                  value={selectedVoiceName}
                  onChange={(event) => chooseVoice(event.target.value)}
                  disabled={!speechVoices.length}
                  className="w-full rounded-xl border border-slate-200 dark:border-purple-800 bg-white dark:bg-[#140b27] px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-purple-100 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 disabled:opacity-60 transition"
                >
                  {speechVoices.some((voice) => voice.lang.toLowerCase().startsWith('en') && !voice.lang.toLowerCase().includes('en-in'))
                    ? speechVoices.filter((voice) => voice.lang.toLowerCase().startsWith('en') && !voice.lang.toLowerCase().includes('en-in')).map((voice) => (
                        <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                          {voice.name} · {voice.lang}
                        </option>
                      ))
                    : <option value="">No US/UK English voice installed</option>}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-purple-400/60 leading-relaxed">
                  Natural English speech synthesis voice for your photorealistic interviewer.
                </p>
              </div>

              {/* Notifications */}
              {voiceToast && (
                <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                  {voiceToast}
                </div>
              )}
              {!isSpeechSupported && (
                <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-200">
                  Voice answers require Web Speech API. Open this interview in Google Chrome or Microsoft Edge.
                </div>
              )}
            </div>

            {/* Enter Arena CTA */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setVoiceToast(null);
                  setHasJoinedVideoCall(true);
                }}
                disabled={!mediaSetupComplete || !microphoneEnabled || !isSpeechSupported || !currentQ}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-fuchsia-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-sm sm:text-base py-3.5 shadow-[0_0_20px_rgba(147,51,234,0.45)] transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span>{mediaSetupComplete ? 'Enter Video Interview Arena' : 'Checking Camera & Microphone…'}</span>
              </button>
              <p className="text-center text-[11px] text-slate-400 dark:text-purple-400/60 font-mono">
                Microphone is active for live voice transcription.
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }
  const candidateLastPhrase = useMemo(() => {
    const raw = (interimTranscript || answerText).trim();
    if (!raw) return '';
    const last = raw.split(/(?<=[.?!])\s+/).pop()?.trim();
    return last || raw;
  }, [interimTranscript, answerText]);


  return (
    <div className={`${session.interview_mode === 'video' ? 'mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6' : 'mx-auto max-w-4xl space-y-6 px-4 py-8'}`}>
      {/* Hunter Status Bar (Shown in Text/Audio modes only) */}
      {session.interview_mode !== 'video' && <HunterStatusBar />}

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

      {/* Top Header: Progress and Timer (Shown in Text/Audio modes only) */}
      {session.interview_mode !== 'video' && (
        <div className="space-y-3 rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-purple-900/60 dark:bg-[#0d071a]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Question {orderIndex} of {totalQuestions}
              </span>
              {currentQ?.category && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600 dark:bg-[#180e30] dark:text-purple-300">
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
      )}

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

      {session.interview_mode === 'audio' && <section className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-[#0d071a] p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-purple-100 dark:bg-purple-950 p-2.5 text-purple-700 dark:text-purple-300">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Live Voice Technical Interview (Audio Only)
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Audio Call Connected
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-purple-300/70">
                Camera and video are off. Your AI interviewer speaks the questions aloud. Use your microphone to respond naturally.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => speakQuestion(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
          >
            <Volume2 className="h-3.5 w-3.5" /> Replay Voice
          </button>
        </div>

        {/* Interviewer Spoken Dialogue / Live Candidate Transcription */}
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 text-xs dark:border-purple-900/50 dark:bg-[#120a24]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1.5 flex items-center gap-2">
            {isInterviewerSpeaking ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Interviewer Speaking
              </>
            ) : isListening ? (
              <>
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Candidate Speaking (Transcribing Live)
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Active Discussion
              </>
            )}
          </p>
          <p className="text-slate-800 dark:text-purple-200 leading-relaxed font-sans text-sm">
            {isInterviewerSpeaking ? (spokenText || currentQ?.text) : isListening ? (interimTranscript || answerText || 'Listening to your answer...') : (currentQ?.text || 'Waiting for next question...')}
          </p>
        </div>

        <div>
          <AudioWaveform active={isListening || isInterviewerSpeaking} />
        </div>
      </section>}

      {session.interview_mode === 'video' && (
        <section
          className={
            isFullscreenVideo
              ? "fixed inset-0 z-50 flex flex-col h-screen w-screen bg-[#07040e] overflow-hidden select-none animate-fade-in"
              : "overflow-hidden rounded-3xl border border-purple-500/30 bg-[#0d071a] shadow-2xl"
          }
          aria-label="Video interview room"
        >
          {/* Executive Conference Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-purple-900/40 bg-gradient-to-r from-purple-950/90 via-[#0d071a] to-purple-950/90 backdrop-blur-md text-white shrink-0">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="Skill Leveling Emblem" className="h-8 w-8 object-contain drop-shadow-[0_0_12px_rgba(147,51,234,0.6)]" />
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  Marcus Vance <span className="text-slate-400 font-normal hidden sm:inline">· Senior Technical Partner</span>
                  <span className="font-mono text-[10px] text-purple-300 uppercase tracking-widest border border-purple-500/50 bg-purple-950/60 px-1.5 py-0.5 rounded">Q{orderIndex}/{totalQuestions}</span>
                </p>
                <p className="text-xs text-purple-300/70 hidden sm:block">Live Technical Assessment · {session.difficulty.toUpperCase()} Dungeon</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {session.duration_minutes && (
                <div className="hidden sm:block">
                  <CountdownTimer
                    secondsRemaining={durationCountdown.secondsRemaining}
                    totalSeconds={durationCountdown.totalSeconds}
                    percentRemaining={durationCountdown.percentRemaining}
                    colorState={durationCountdown.colorState}
                    formattedTime={durationCountdown.formattedTime}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 text-xs font-mono text-purple-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span className="hidden sm:inline">Live Call Connected</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreenVideo((prev) => !prev)}
                title={isFullscreenVideo ? "Exit full screen" : "Enter full screen"}
                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                {isFullscreenVideo ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Main Stage: Rock-Solid Photorealistic Video Stream */}
          <div className={`relative w-full overflow-hidden bg-[#090a0f] flex-1 ${isFullscreenVideo ? 'h-full' : 'h-[min(64vh,680px)] min-h-[420px]'}`}>
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-900" aria-label="Loading interviewer" />}>
              <AvatarStage className="h-full w-full rounded-none" speaking={isInterviewerSpeaking} listening={isListening} viseme={viseme} isEvaluating={isSubmitting} />
            </Suspense>

            {/* Line-by-Line Floating Closed-Caption Pill (Streams 1 sentence at a time, never overrides Marcus Vance) */}
            {(isInterviewerSpeaking ? (activeSubtitleLine || spokenText || currentQ?.text) : isListening ? (candidateLastPhrase ? `🗣️ You: ${candidateLastPhrase}` : 'Listening to your response…') : null) && (
              <div aria-live="polite" className="pointer-events-none absolute bottom-4 inset-x-0 z-30 flex justify-center px-4 sm:px-8">
                <div className="inline-flex max-w-2xl items-center gap-2.5 rounded-full bg-black/85 px-6 py-2.5 text-xs sm:text-sm font-medium text-slate-100 shadow-2xl border border-white/15 backdrop-blur-xl text-center leading-relaxed animate-fade-in transition-all duration-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="line-clamp-2">
                    {isInterviewerSpeaking
                      ? (activeSubtitleLine || spokenText || currentQ?.text)
                      : isListening
                      ? (candidateLastPhrase ? `🗣️ You: ${candidateLastPhrase}` : 'Listening to your response…')
                      : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Candidate PiP Camera Preview */}
            <div className={`absolute right-4 top-4 h-28 w-40 sm:h-38 sm:w-56 overflow-hidden rounded-2xl border bg-[#1a1b1f] shadow-2xl transition-all z-20 ${isListening ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.4)]' : 'border-white/20'}`}>
              {cameraEnabled ? (
                <video ref={cameraRef} autoPlay muted playsInline aria-label="Your local camera preview" className="h-full w-full scale-x-[-1] object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-base font-bold shadow">
                    {candidateFirstName ? candidateFirstName[0].toUpperCase() : 'Y'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Camera off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                {microphoneEnabled ? <Mic className="h-3 w-3 text-emerald-400" /> : <MicOff className="h-3 w-3 text-rose-400" />}
                <span>{candidateFirstName || 'You'}</span>
              </div>
            </div>
          </div>

          {/* Executive Conference Controls Dock */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 sm:px-8 border-t border-purple-900/40 bg-gradient-to-r from-purple-950/95 via-[#0d071a] to-purple-950/95 backdrop-blur-xl">
            {/* Real-time Status & Audio Waveform */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
              <span className={`h-2.5 w-2.5 rounded-full ${isListening ? 'bg-blue-400 animate-pulse' : isInterviewerSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-xs font-mono text-purple-200">
                {isListening ? 'Listening to your response…' : isInterviewerSpeaking ? 'Marcus Vance is speaking…' : isSubmitting ? 'Evaluating response…' : 'Microphone ready'}
              </span>
              {isListening && <div className="w-24 sm:w-32"><AudioWaveform active barCount={16} /></div>}
            </div>

            {/* Conference Action Buttons */}
            <div className="flex items-center gap-2.5 sm:gap-4">
              <button
                type="button"
                onClick={toggleMicrophone}
                aria-pressed={microphoneEnabled}
                title={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${microphoneEnabled ? 'bg-[#3c4043] text-white hover:bg-[#4e5357]' : 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]'}`}
              >
                {microphoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${cameraEnabled ? 'bg-[#3c4043] text-white hover:bg-[#4e5357]' : 'bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.5)]'}`}
              >
                {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={() => speakText(`Here is question ${orderIndex} again: ${currentQ?.text}`, true)}
                title="Repeat question aloud"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3c4043] text-white transition-all duration-200 hover:bg-[#4e5357]"
              >
                <Volume2 className="h-5 w-5" />
              </button>

              {!justEvaluatedFeedback && (
                <button
                  type="button"
                  onClick={() => handleSubmitAnswer(false)}
                  disabled={!answerText.trim() || isSubmitting || !microphoneEnabled}
                  className="flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 px-5 text-xs sm:text-sm font-bold text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] hover:opacity-90 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" /> Submit Answer
                </button>
              )}

              <button
                type="button"
                onClick={handleEndVideoCall}
                disabled={completeSessionMutation.isPending}
                title="End video call"
                className="flex h-11 items-center justify-center rounded-full bg-rose-600 px-4 text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>
      )}

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

