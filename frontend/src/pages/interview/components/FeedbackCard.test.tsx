import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackCard } from './FeedbackCard';

describe('FeedbackCard component', () => {
  it('renders score, 4 dimension bars, strengths, improvements, and collapsible outline', () => {
    const onNextMock = vi.fn();

    render(
      <FeedbackCard
        evalStatus="done"
        score={8}
        dimensions={{
          relevance: 9,
          accuracy: 8,
          depth: 7,
          clarity: 8,
        }}
        strengths={['Clear communication', 'Solid architecture']}
        improvements={['Discuss rollbacks']}
        missedPoints={['Lock timeouts']}
        idealOutline={['Step 1: Expand', 'Step 2: Contract']}
        isLastQuestion={false}
        onNextOrFinish={onNextMock}
      />
    );

    expect(screen.getByTestId('score-value')).toHaveTextContent('8');
    expect(screen.getByText('Relevance')).toBeInTheDocument();
    expect(screen.getByText('9/10')).toBeInTheDocument();
    expect(screen.getByText('Clear communication')).toBeInTheDocument();
    expect(screen.getByText('Discuss rollbacks')).toBeInTheDocument();
    expect(screen.getByText('Lock timeouts')).toBeInTheDocument();

    // Toggle ideal outline
    const toggleBtn = screen.getByTestId('toggle-ideal-outline');
    expect(screen.queryByTestId('ideal-outline-content')).not.toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('ideal-outline-content')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Expand')).toBeInTheDocument();

    // Next question button
    const nextBtn = screen.getByTestId('next-or-finish-button');
    expect(nextBtn).toHaveTextContent('Next question');
    fireEvent.click(nextBtn);
    expect(onNextMock).toHaveBeenCalledTimes(1);
  });

  it('handles null and empty fields gracefully without crashing', () => {
    const onNextMock = vi.fn();

    render(
      <FeedbackCard
        evalStatus="done"
        score={null}
        dimensions={null}
        strengths={[]}
        improvements={[]}
        missedPoints={[]}
        idealOutline={[]}
        isLastQuestion={true}
        onNextOrFinish={onNextMock}
      />
    );

    expect(screen.getByTestId('score-value')).toHaveTextContent('0');
    expect(screen.getByText('No specific strengths recorded.')).toBeInTheDocument();
    expect(screen.getByText('No specific improvements suggested.')).toBeInTheDocument();
    expect(screen.queryByTestId('missed-points-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-ideal-outline')).not.toBeInTheDocument();

    // Last question shows 'Finish session'
    const finishBtn = screen.getByTestId('next-or-finish-button');
    expect(finishBtn).toHaveTextContent('Finish session');
  });

  it('renders failure UX when evalStatus === "failed"', () => {
    const onRetryMock = vi.fn();
    const onContinueMock = vi.fn();

    render(
      <FeedbackCard
        evalStatus="failed"
        score={null}
        dimensions={null}
        strengths={[]}
        improvements={[]}
        isLastQuestion={false}
        onNextOrFinish={vi.fn()}
        onRetryEval={onRetryMock}
        onContinueAnyway={onContinueMock}
      />
    );

    expect(screen.getByTestId('feedback-card-failed')).toBeInTheDocument();
    expect(
      screen.getByText("We saved your answer but couldn't evaluate it")
    ).toBeInTheDocument();

    const retryBtn = screen.getByTestId('retry-eval-button');
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);

    const continueBtn = screen.getByTestId('continue-anyway-button');
    fireEvent.click(continueBtn);
    expect(onContinueMock).toHaveBeenCalledTimes(1);
  });

  it('renders Solo Leveling level-up gain and penalty banners when deltaInfo is provided', () => {
    // 1. Correct gain
    const { rerender } = render(
      <FeedbackCard
        evalStatus="done"
        score={9}
        dimensions={{ relevance: 9, accuracy: 9, depth: 8, clarity: 9 }}
        strengths={['Flawless']}
        improvements={[]}
        isLastQuestion={false}
        deltaInfo={{
          isCorrect: true,
          score: 9,
          delta: 10,
          reason: 'Correct evaluation (9/10) gained +10 Level points!',
        }}
        onNextOrFinish={vi.fn()}
      />
    );

    expect(screen.getByText(/Hunter Awakening · Level Progress/i)).toBeInTheDocument();
    expect(screen.getByText('+10 LVL')).toBeInTheDocument();

    // 2. Penalty deduction
    rerender(
      <FeedbackCard
        evalStatus="done"
        score={4}
        dimensions={{ relevance: 4, accuracy: 4, depth: 3, clarity: 5 }}
        strengths={[]}
        improvements={['Needs depth']}
        isLastQuestion={false}
        deltaInfo={{
          isCorrect: false,
          score: 4,
          delta: -3.3,
          reason: 'Answer scored below threshold (4/10): -3.3 Penalty points applied!',
        }}
        onNextOrFinish={vi.fn()}
      />
    );

    expect(screen.getByText(/System Penalty · 1\/3 Deduction Applied/i)).toBeInTheDocument();
    expect(screen.getByText('-3.3 LVL')).toBeInTheDocument();
  });
});

