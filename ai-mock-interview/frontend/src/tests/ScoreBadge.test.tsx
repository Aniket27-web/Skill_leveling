import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoreBadge } from '../components/ScoreBadge';

describe('ScoreBadge Component', () => {
  it('renders emerald style for score >= 80', () => {
    render(<ScoreBadge score={85} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveTextContent('85%');
    expect(badge.className).toContain('text-emerald-400');
  });

  it('renders amber style for score between 60 and 79', () => {
    render(<ScoreBadge score={72} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveTextContent('72%');
    expect(badge.className).toContain('text-amber-400');
  });

  it('renders rose style for score < 60', () => {
    render(<ScoreBadge score={45} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveTextContent('45%');
    expect(badge.className).toContain('text-rose-400');
  });

  it('renders neutral style when score is null', () => {
    render(<ScoreBadge score={null} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveTextContent('N/A');
    expect(badge.className).toContain('text-slate-400');
  });

  it('renders neutral style when score is undefined', () => {
    render(<ScoreBadge score={undefined} />);
    const badge = screen.getByTestId('score-badge');
    expect(badge).toHaveTextContent('N/A');
    expect(badge.className).toContain('text-slate-400');
  });
});
