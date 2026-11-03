import { useEffect, useRef, useState, useMemo } from 'react';

export type CountdownColorState = 'normal' | 'warning' | 'danger';

export interface UseCountdownOptions {
  serverSecondsRemaining: number | null | undefined;
  totalSeconds: number | null | undefined;
  onExpire?: () => void;
  enabled?: boolean;
}

export interface UseCountdownReturn {
  secondsRemaining: number;
  totalSeconds: number;
  percentRemaining: number;
  colorState: CountdownColorState;
  isExpired: boolean;
  formattedTime: string;
}

/**
 * Server-authoritative countdown timer hook.
 *
 * Rules:
 * - Syncs with server-provided seconds_remaining on every fetch/change.
 * - Ticks down locally every second.
 * - Color state switches at 25% (warning) and 10% (danger).
 * - Fires onExpire EXACTLY ONCE when seconds hit zero.
 */
export function useCountdown({
  serverSecondsRemaining,
  totalSeconds = 60,
  onExpire,
  enabled = true,
}: UseCountdownOptions): UseCountdownReturn {
  const safeTotal = Math.max(1, totalSeconds ?? 60);

  // Initialize from server seconds or total
  const initialSeconds =
    serverSecondsRemaining !== null && serverSecondsRemaining !== undefined
      ? Math.max(0, serverSecondsRemaining)
      : safeTotal;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialSeconds);
  const hasExpiredRef = useRef<boolean>(initialSeconds <= 0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Re-sync with server authoritative time whenever serverSecondsRemaining changes
  useEffect(() => {
    if (serverSecondsRemaining !== null && serverSecondsRemaining !== undefined) {
      const clamped = Math.max(0, serverSecondsRemaining);
      setSecondsRemaining(clamped);
      if (clamped > 0) {
        hasExpiredRef.current = false;
      }
    }
  }, [serverSecondsRemaining]);

  // Local 1-second ticking interval
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Handle expiry trigger exactly once when secondsRemaining reaches 0
  useEffect(() => {
    if (secondsRemaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [secondsRemaining]);

  // Derived calculations
  const percentRemaining = useMemo(() => {
    return Math.max(0, Math.min(100, (secondsRemaining / safeTotal) * 100));
  }, [secondsRemaining, safeTotal]);

  const colorState = useMemo<CountdownColorState>(() => {
    if (percentRemaining <= 10) return 'danger';
    if (percentRemaining <= 25) return 'warning';
    return 'normal';
  }, [percentRemaining]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  }, [secondsRemaining]);

  return {
    secondsRemaining,
    totalSeconds: safeTotal,
    percentRemaining,
    colorState,
    isExpired: secondsRemaining <= 0,
    formattedTime,
  };
}
