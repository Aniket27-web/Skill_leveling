import { useState, useEffect, useRef, useCallback } from 'react';

// Browser SpeechRecognition interface typing
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null;
}

export interface UseSpeechRecognitionOptions {
  onFinalTranscript?: (transcript: string) => void;
  onError?: (errorMessage: string, rawError: string) => void;
  lang?: string;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  usedVoice: boolean;
  error: string | null;
  errorMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetVoiceTracking: () => void;
}

/**
 * Speech recognition hook using standard / webkit SpeechRecognition.
 * Supports continuous recognition, interim streaming, permission handling, and voice usage tracking.
 */
export function useSpeechRecognition({
  onFinalTranscript,
  onError,
  lang = 'en-US',
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [usedVoice, setUsedVoice] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Detect support on mount
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    setIsSupported(Boolean(SpeechRecognitionCtor));
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [isListening]);

  const startListening = useCallback(() => {
    setError(null);
    setErrorMessage(null);

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      const msg = 'Voice recognition is not supported in this browser. Please use Chrome or Edge.';
      setError('unsupported');
      setErrorMessage(msg);
      onErrorRef.current?.(msg, 'unsupported');
      return;
    }

    try {
      if (!recognitionRef.current) {
        const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
          setErrorMessage(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            const transcriptChunk = res[0]?.transcript || '';

            if (res.isFinal) {
              const cleaned = transcriptChunk.trim();
              if (cleaned) {
                setUsedVoice(true);
                onFinalRef.current?.(cleaned);
              }
            } else {
              interim += transcriptChunk;
            }
          }
          setInterimTranscript(interim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          const rawErr = event.error;
          let userMsg = 'Speech recognition error occurred.';

          if (rawErr === 'not-allowed' || rawErr === 'service-not-allowed') {
            userMsg = 'Microphone permission denied. Please allow microphone access in your browser.';
          } else if (rawErr === 'no-speech') {
            userMsg = 'No speech was detected. Please try speaking closer to the mic.';
          } else if (rawErr === 'network') {
            userMsg = 'Network error during speech recognition.';
          }

          setError(rawErr);
          setErrorMessage(userMsg);
          setIsListening(false);
          onErrorRef.current?.(userMsg, rawErr);
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
        };

        recognitionRef.current = recognition;
      }

      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      const msg = err?.message || 'Could not start speech recognition.';
      setError('start-failure');
      setErrorMessage(msg);
      onErrorRef.current?.(msg, 'start-failure');
      setIsListening(false);
    }
  }, [lang]);

  const resetVoiceTracking = useCallback(() => {
    setUsedVoice(false);
    setInterimTranscript('');
    setError(null);
    setErrorMessage(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    usedVoice,
    error,
    errorMessage,
    startListening,
    stopListening,
    resetVoiceTracking,
  };
}
