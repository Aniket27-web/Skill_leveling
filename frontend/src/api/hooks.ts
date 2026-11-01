import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Session, AnswerPayload, AnswerResponse, CompleteResponse } from './types';

interface UseSessionOptions {
  refetchInterval?: number | false | ((query: any) => number | false);
}

/**
 * Fetch a session by id with optional polling interval
 */
export function useSession(id: string | undefined, options?: UseSessionOptions) {
  return useQuery<Session>({
    queryKey: ['session', id],
    queryFn: async () => {
      if (!id) throw new Error('Session ID is required');
      const res = await fetch(`/api/sessions/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Failed to fetch session (${res.status})`);
      }
      return res.json();
    },
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

interface SubmitAnswerVariables {
  sessionId: string;
  questionId: string;
  payload: AnswerPayload;
  idempotencyKey?: string;
}

/**
 * Submit an answer for a question in a session
 */
export function useSubmitAnswer() {
  const queryClient = useQueryClient();

  return useMutation<AnswerResponse, Error, SubmitAnswerVariables>({
    mutationFn: async ({ sessionId, questionId, payload, idempotencyKey }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const res = await fetch(`/api/sessions/${sessionId}/questions/${questionId}/answer`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Answer submission failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
    },
  });
}

interface RetryEvalVariables {
  sessionId: string;
  questionId: string;
}

/**
 * Retry evaluation for a failed question
 */
export function useRetryEval() {
  const queryClient = useQueryClient();

  return useMutation<AnswerResponse, Error, RetryEvalVariables>({
    mutationFn: async ({ sessionId, questionId }) => {
      const res = await fetch(`/api/sessions/${sessionId}/questions/${questionId}/retry-eval`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Retry evaluation failed (${res.status})`);
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
    },
  });
}

/**
 * Complete a session early or after all questions
 */
export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation<CompleteResponse, Error, string>({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Failed to complete session (${res.status})`);
      }

      return res.json();
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}

/**
 * Download PDF report for a completed session
 */
export async function downloadReport(sessionId: string): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/report`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to download report (${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `mock-interview-${sessionId.slice(0, 8)}-${dateStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
