import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InterviewPage } from './InterviewPage';

// Mock the API hooks
vi.mock('../../api/hooks', () => ({
  useSession: vi.fn(),
  useSubmitAnswer: vi.fn(),
  useRetryEval: vi.fn(),
  useCompleteSession: vi.fn(),
  downloadReport: vi.fn(),
}));

import { useSession, useSubmitAnswer } from '../../api/hooks';

describe('Draft preservation in InterviewPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const renderInterview = (sessionId: string = 'sess-123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/interview/${sessionId}`]}>
          <Routes>
            <Route path="/interview/:id" element={<InterviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('mirrors typed text into sessionStorage keyed by question id', () => {
    (useSession as any).mockReturnValue({
      data: {
        id: 'sess-123',
        status: 'in_progress',
        num_questions: 3,
        current_question: {
          id: 'q-abc',
          order_index: 1,
          text: 'Explain React reconciliation',
          category: 'skill',
          seconds_remaining: 120,
        },
        questions: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (useSubmitAnswer as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    renderInterview('sess-123');

    const textarea = screen.getByTestId('answer-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');

    // Type text into textarea
    fireEvent.change(textarea, { target: { value: 'Virtual DOM diffing algorithm' } });

    expect(textarea.value).toBe('Virtual DOM diffing algorithm');

    // Verify sessionStorage has mirrored draft
    const saved = sessionStorage.getItem('draft_answer_sess-123_q-abc');
    expect(saved).toBe('Virtual DOM diffing algorithm');
  });

  it('restores draft from sessionStorage when revisiting or refreshing the question', () => {
    // Pre-populate sessionStorage draft
    sessionStorage.setItem(
      'draft_answer_sess-123_q-xyz',
      'My existing draft about microservices'
    );

    (useSession as any).mockReturnValue({
      data: {
        id: 'sess-123',
        status: 'in_progress',
        num_questions: 3,
        current_question: {
          id: 'q-xyz',
          order_index: 2,
          text: 'Explain microservices communication',
          category: 'experience',
          seconds_remaining: 120,
        },
        questions: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (useSubmitAnswer as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    renderInterview('sess-123');

    const textarea = screen.getByTestId('answer-textarea') as HTMLTextAreaElement;
    // Draft should be automatically restored
    expect(textarea.value).toBe('My existing draft about microservices');
  });

  it('preserves typed text and shows Retry button on submission network error', async () => {
    (useSession as any).mockReturnValue({
      data: {
        id: 'sess-123',
        status: 'in_progress',
        num_questions: 3,
        current_question: {
          id: 'q-network',
          order_index: 1,
          text: 'Explain distributed locks',
          category: 'skill',
          seconds_remaining: 120,
        },
        questions: [],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const mockMutate = vi.fn().mockRejectedValue(new Error('Network failure: Connection refused'));
    (useSubmitAnswer as any).mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    });

    renderInterview('sess-123');

    const textarea = screen.getByTestId('answer-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Redlock with Redis and TTL' } });

    const submitBtn = screen.getByTestId('submit-answer-button');
    fireEvent.click(submitBtn);

    // Wait for error banner
    await waitFor(() => {
      expect(screen.getByTestId('network-error-banner')).toBeInTheDocument();
    });

    // Verify textarea STILL has the user's text (never lost)
    expect(textarea.value).toBe('Redlock with Redis and TTL');
    expect(screen.getByText(/Network failure: Connection refused/)).toBeInTheDocument();
  });
});
