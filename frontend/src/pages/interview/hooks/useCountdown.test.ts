import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from './useCountdown';

describe('useCountdown hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with server-provided seconds and calculates percentage', () => {
    const { result } = renderHook(() =>
      useCountdown({
        serverSecondsRemaining: 60,
        totalSeconds: 120,
      })
    );

    expect(result.current.secondsRemaining).toBe(60);
    expect(result.current.totalSeconds).toBe(120);
    expect(result.current.percentRemaining).toBe(50);
    expect(result.current.colorState).toBe('normal');
    expect(result.current.formattedTime).toBe('1:00');
    expect(result.current.isExpired).toBe(false);
  });

  it('ticks down locally every second', () => {
    const { result } = renderHook(() =>
      useCountdown({
        serverSecondsRemaining: 30,
        totalSeconds: 30,
      })
    );

    expect(result.current.secondsRemaining).toBe(30);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.secondsRemaining).toBe(25);
  });

  it('transitions colorState at 25% (warning) and 10% (danger)', () => {
    const { result } = renderHook(() =>
      useCountdown({
        serverSecondsRemaining: 100,
        totalSeconds: 100,
      })
    );

    expect(result.current.colorState).toBe('normal');

    // Fast-forward to 25s remaining (25% -> warning)
    act(() => {
      vi.advanceTimersByTime(75000);
    });
    expect(result.current.secondsRemaining).toBe(25);
    expect(result.current.colorState).toBe('warning');

    // Fast-forward to 10s remaining (10% -> danger)
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current.secondsRemaining).toBe(10);
    expect(result.current.colorState).toBe('danger');
  });

  it('re-syncs with server authoritative time whenever serverSecondsRemaining changes', () => {
    const { result, rerender } = renderHook(
      ({ serverSecs }) =>
        useCountdown({
          serverSecondsRemaining: serverSecs,
          totalSeconds: 60,
        }),
      {
        initialProps: { serverSecs: 50 },
      }
    );

    expect(result.current.secondsRemaining).toBe(50);

    // Local tick down
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.secondsRemaining).toBe(40);

    // New server fetch reports 45 seconds (server authoritative re-sync)
    rerender({ serverSecs: 45 });
    expect(result.current.secondsRemaining).toBe(45);
  });

  it('fires onExpire EXACTLY ONCE when countdown hits zero', () => {
    const onExpireMock = vi.fn();

    const { result } = renderHook(() =>
      useCountdown({
        serverSecondsRemaining: 3,
        totalSeconds: 10,
        onExpire: onExpireMock,
      })
    );

    // Advance 2 seconds -> remaining 1, not expired
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsRemaining).toBe(1);
    expect(onExpireMock).not.toHaveBeenCalled();

    // Advance 1 second -> remaining 0, fires onExpire
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(onExpireMock).toHaveBeenCalledTimes(1);

    // Advance another 5 seconds -> must NOT fire again
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.secondsRemaining).toBe(0);
    expect(onExpireMock).toHaveBeenCalledTimes(1);
  });
});
