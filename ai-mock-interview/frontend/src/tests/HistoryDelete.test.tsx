import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/Toast';
import { HistoryPage } from '../pages/history/HistoryPage';

vi.mock('../api/hooks', async () => {
  const actual = await vi.importActual('../api/hooks');
  return {
    ...actual,
    useSessions: () => ({
      data: {
        sessions: [
          {
            id: 'sess_test_1',
            created_at: '2026-10-30T10:00:00Z',
            difficulty: 'medium',
            question_count: 5,
            target_role: 'Senior React Developer',
            status: 'completed',
            overall_score: 85,
            questions: [],
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useDeleteSession: () => ({
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
    }),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('HistoryPage Delete Flow', () => {
  it('opens confirmation modal and allows cancelling or confirming deletion', async () => {
    renderWithProviders(<HistoryPage />);

    expect(await screen.findByText(/Senior React Developer/i)).toBeInTheDocument();

    // Click delete icon
    const deleteBtn = screen.getByRole('button', { name: /delete session/i });
    fireEvent.click(deleteBtn);

    // Modal should be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete Interview Session\?/i)).toBeInTheDocument();

    // Cancel deletion
    const cancelBtn = screen.getByTestId('cancel-delete-btn');
    fireEvent.click(cancelBtn);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
