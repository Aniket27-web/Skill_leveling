import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/Toast';
import { LoginPage } from '../pages/auth/LoginPage';

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

describe('LoginPage Validation & Error Display', () => {
  it('validates required fields on submission', async () => {
    renderWithProviders(<LoginPage />);

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('email-error')).toHaveTextContent(/email address is required/i);
    expect(await screen.findByTestId('password-error')).toHaveTextContent(/password is required/i);
  });

  it('validates invalid email format', async () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/alex.developer@example.com/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email-address' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('email-error')).toHaveTextContent(/valid email address/i);
  });

  it('validates minimum password length of 8 characters', async () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/alex.developer@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('password-error')).toHaveTextContent(/at least 8 characters/i);
  });
});
