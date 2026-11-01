import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/Toast';
import { NewSessionPage } from '../pages/setup/NewSessionPage';

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

describe('NewSessionPage File Validation', () => {
  it('rejects unsupported file formats like .txt or .png', async () => {
    renderWithProviders(<NewSessionPage />);

    const fileInput = screen.getByTestId('resume-file-input');
    const invalidFile = new File(['dummy content'], 'portfolio.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    const clientError = await screen.findByTestId('resume-client-error');
    expect(clientError).toHaveTextContent(/unsupported file format/i);
  });

  it('rejects files larger than 5MB', async () => {
    renderWithProviders(<NewSessionPage />);

    const fileInput = screen.getByTestId('resume-file-input');
    // Create dummy 6MB file
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'huge_resume.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    const clientError = await screen.findByTestId('resume-client-error');
    expect(clientError).toHaveTextContent(/exceeds 5mb limit/i);
  });
});
