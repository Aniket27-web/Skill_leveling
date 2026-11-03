import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InterviewPage } from './pages/interview/InterviewPage';
import { SummaryPage } from './pages/summary/SummaryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
          {/* Global Header Navigation */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  AI
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-base tracking-tight">
                    Mock Interview Coach
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full ml-2">
                    v1.0
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 pb-16">
            <Routes>
              <Route path="/interview/:id" element={<InterviewPage />} />
              <Route path="/summary/:id" element={<SummaryPage />} />
              <Route path="*" element={<Navigate to="/interview/sample-session" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

