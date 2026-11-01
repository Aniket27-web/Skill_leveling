import { useMemo, useState, useEffect, useRef } from 'react';

export interface FillerStats {
  total: number;
  breakdown: {
    um: number;
    uh: number;
    like: number;
  };
}

export interface DeliveryStats {
  wordCount: number;
  charCount: number;
  fillerStats: FillerStats;
  wpm: number;
  paceRating: 'deliberate' | 'optimal' | 'fast';
}

/**
 * Hook to calculate live delivery stats (words, WPM, and filler words "um", "uh", "like")
 * beside the candidate's answer. These are purely informational and not part of scoring.
 */
export function useDeliveryStats(text: string, isActive: boolean = true): DeliveryStats {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);

  // Track elapsed answering duration when user has started typing/speaking
  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (text.trim().length > 0 && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    if (startTimeRef.current === null) {
      return;
    }

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [text, isActive]);

  // Reset timer if text is cleared completely
  useEffect(() => {
    if (text.trim().length === 0) {
      startTimeRef.current = null;
      setElapsedSeconds(0);
    }
  }, [text]);

  return useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const charCount = text.length;

    // Detect filler words ("um", "uh", "like")
    let umCount = 0;
    let uhCount = 0;
    let likeCount = 0;

    const umMatches = text.match(/\bum\b/gi);
    if (umMatches) umCount = umMatches.length;

    const uhMatches = text.match(/\buh\b/gi);
    if (uhMatches) uhCount = uhMatches.length;

    const likeMatches = text.match(/\blike\b/gi);
    if (likeMatches) likeCount = likeMatches.length;

    const totalFillers = umCount + uhCount + likeCount;

    // Calculate live Words Per Minute (WPM)
    const activeMinutes = Math.max(elapsedSeconds, 5) / 60;
    const rawWpm = Math.round(wordCount / activeMinutes);
    const wpm = wordCount > 0 ? Math.min(250, rawWpm) : 0;

    let paceRating: 'deliberate' | 'optimal' | 'fast' = 'optimal';
    if (wpm < 110) {
      paceRating = 'deliberate';
    } else if (wpm > 160) {
      paceRating = 'fast';
    }

    return {
      wordCount,
      charCount,
      fillerStats: {
        total: totalFillers,
        breakdown: {
          um: umCount,
          uh: uhCount,
          like: likeCount,
        },
      },
      wpm,
      paceRating,
    };
  }, [text, elapsedSeconds]);
}

