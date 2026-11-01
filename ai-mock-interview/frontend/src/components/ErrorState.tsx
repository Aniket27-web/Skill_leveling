import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an unexpected issue while loading data. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`rounded-2xl glass-panel border border-rose-500/20 bg-rose-950/20 p-6 text-center flex flex-col items-center justify-center my-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-inner">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-200 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-300 mt-1.5 max-w-md">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
