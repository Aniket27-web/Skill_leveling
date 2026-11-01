import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  Resume,
  Session,
  CreateSessionRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  RetryEvalResponse,
  CompleteSessionResponse,
  SessionsListResponse,
  ProgressResponse,
} from './types';

// AUTH HOOKS
export function useMe() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const response = await apiClient<AuthResponse | User>('/api/auth/me');
        if ('user' in response) {
          return response.user;
        }
        return response;
      } catch (err: unknown) {
        // Return null for unauthenticated rather than throwing
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, Error, LoginRequest>({
    mutationFn: (data: LoginRequest) =>
      apiClient<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: data,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, Error, RegisterRequest>({
    mutationFn: (data: RegisterRequest) =>
      apiClient<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: data,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, void>({
    mutationFn: () =>
      apiClient<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.clear();
    },
  });
}

// RESUME HOOKS
export function useResumes() {
  return useQuery<Resume[]>({
    queryKey: ['resumes'],
    queryFn: () => apiClient<Resume[]>('/api/resumes'),
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation<Resume, Error, File>({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient<Resume>('/api/resumes', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
}

// SESSION HOOKS
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation<Session, Error, CreateSessionRequest>({
    mutationFn: (payload: CreateSessionRequest) =>
      apiClient<Session>('/api/sessions', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export interface UseSessionOptions {
  refetchInterval?: number | false | ((query: unknown) => number | false);
}

export function useSession(id: string, options?: UseSessionOptions) {
  return useQuery<Session>({
    queryKey: ['session', id],
    queryFn: () => apiClient<Session>(`/api/sessions/${id}`),
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

export interface SubmitAnswerMutationVariables extends SubmitAnswerRequest {
  sessionId: string;
}

export function useSubmitAnswer() {
  const queryClient = useQueryClient();
  return useMutation<SubmitAnswerResponse, Error, SubmitAnswerMutationVariables>({
    mutationFn: ({ sessionId, question_id, answer, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      return apiClient<SubmitAnswerResponse>(`/api/sessions/${sessionId}/answers`, {
        method: 'POST',
        headers,
        body: { question_id, answer, idempotencyKey },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
    },
  });
}

export interface RetryEvalVariables {
  sessionId: string;
  questionId: string;
}

export function useRetryEval() {
  const queryClient = useQueryClient();
  return useMutation<RetryEvalResponse, Error, RetryEvalVariables>({
    mutationFn: ({ sessionId, questionId }) =>
      apiClient<RetryEvalResponse>(`/api/sessions/${sessionId}/questions/${questionId}/retry-eval`, {
        method: 'POST',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', variables.sessionId] });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation<CompleteSessionResponse, Error, string>({
    mutationFn: (sessionId: string) =>
      apiClient<CompleteSessionResponse>(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
      }),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useSessions(limit: number = 10, offset: number = 0) {
  return useQuery<SessionsListResponse>({
    queryKey: ['sessions', limit, offset],
    queryFn: () => apiClient<SessionsListResponse>(`/api/sessions?limit=${limit}&offset=${offset}`),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string, { previousSessions?: SessionsListResponse }>({
    mutationFn: (sessionId: string) =>
      apiClient<{ success: boolean }>(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      }),
    onMutate: async (deletedId: string) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      const previousSessions = queryClient.getQueryData<SessionsListResponse>(['sessions', 10, 0]);

      if (previousSessions) {
        queryClient.setQueryData<SessionsListResponse>(['sessions', 10, 0], {
          ...previousSessions,
          sessions: previousSessions.sessions.filter((s) => s.id !== deletedId),
          total: Math.max(0, previousSessions.total - 1),
        });
      }

      return { previousSessions };
    },
    onError: (_err, _deletedId, context) => {
      // Rollback on error
      if (context?.previousSessions) {
        queryClient.setQueryData(['sessions', 10, 0], context.previousSessions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useProgress() {
  return useQuery<ProgressResponse>({
    queryKey: ['progress'],
    queryFn: () => apiClient<ProgressResponse>('/api/progress'),
  });
}

export async function downloadReport(sessionId: string): Promise<void> {
  const blob = await apiClient<Blob>(`/api/sessions/${sessionId}/report`, {
    method: 'GET',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `interview-report-${sessionId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
