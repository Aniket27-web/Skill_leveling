import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition, SpeechRecognitionInstance } from './useSpeechRecognition';

describe('useSpeechRecognition hook', () => {
  const originalSpeech = (window as any).SpeechRecognition;
  const originalWebkitSpeech = (window as any).webkitSpeechRecognition;

  beforeEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  afterEach(() => {
    (window as any).SpeechRecognition = originalSpeech;
    (window as any).webkitSpeechRecognition = originalWebkitSpeech;
  });

  it('detects unsupported browser when SpeechRecognition is not present', () => {
    const onErrorMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onError: onErrorMock })
    );

    expect(result.current.isSupported).toBe(false);

    act(() => {
      result.current.startListening();
    });

    expect(result.current.error).toBe('unsupported');
    expect(result.current.isListening).toBe(false);
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('not supported'),
      'unsupported'
    );
  });

  it('starts recognition, receives speech results and marks usedVoice = true', () => {
    let mockInstance: any = null;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      onresult: any = null;

      constructor() {
        mockInstance = this;
      }

      start = vi.fn(() => {
        if (this.onstart) this.onstart(new Event('start'));
      });
      stop = vi.fn(() => {
        if (this.onend) this.onend(new Event('end'));
      });
      abort = vi.fn();
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;

    const onFinalTranscriptMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalTranscript: onFinalTranscriptMock })
    );

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);
    expect(result.current.usedVoice).toBe(false);

    // Start listening
    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);

    // Simulate final speech recognition event
    act(() => {
      const mockEvent = {
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: 'I designed a distributed database architecture' }], {
            isFinal: true,
            length: 1,
            item: () => ({ transcript: 'I designed a distributed database architecture' }),
          }),
        ],
      };
      mockInstance.onresult(mockEvent);
    });

    expect(onFinalTranscriptMock).toHaveBeenCalledWith('I designed a distributed database architecture');
    expect(result.current.usedVoice).toBe(true);

    // Stop listening
    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
  });

  it('handles microphone permission denied error gracefully', () => {
    let mockInstance: any = null;

    class MockSpeechRecognition {
      onstart: any = null;
      onerror: any = null;
      onend: any = null;
      start = vi.fn(() => {
        if (this.onstart) this.onstart(new Event('start'));
      });
      stop = vi.fn();
      abort = vi.fn();

      constructor() {
        mockInstance = this;
      }
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;

    const onErrorMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onError: onErrorMock })
    );

    act(() => {
      result.current.startListening();
    });

    // Simulate permission denied event
    act(() => {
      mockInstance.onerror({
        error: 'not-allowed',
        message: 'Permission denied',
      });
    });

    expect(result.current.error).toBe('not-allowed');
    expect(result.current.errorMessage).toContain('Microphone permission denied');
    expect(result.current.isListening).toBe(false);
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('Microphone permission denied'),
      'not-allowed'
    );
  });
});

