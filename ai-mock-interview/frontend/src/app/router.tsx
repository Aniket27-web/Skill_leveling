import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { NewSessionPage } from '../pages/setup/NewSessionPage';
import { HistoryPage } from '../pages/history/HistoryPage';
import { ProgressPage } from '../pages/progress/ProgressPage';
import { Spinner } from '../components/Spinner';

// Lazy-loaded routes reserved for P4
const InterviewView = lazy(() =>
  import('../pages/interview/InterviewPlaceholder').then((m) => ({
    default: m.InterviewPlaceholder,
  }))
);

const SummaryView = lazy(() =>
  import('../pages/summary/SummaryPlaceholder').then((m) => ({
    default: m.SummaryPlaceholder,
  }))
);

const LazyLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <span className="mt-3 text-xs text-slate-400">Loading module...</span>
      </div>
    }
  >
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  // Public Auth Routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },

  // Protected App Routes
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'sessions/new',
        element: <NewSessionPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'progress',
        element: <ProgressPage />,
      },
      // P4 Reserved routes
      {
        path: 'interview/:id',
        element: (
          <LazyLoader>
            <InterviewView />
          </LazyLoader>
        ),
      },
      {
        path: 'summary/:id',
        element: (
          <LazyLoader>
            <SummaryView />
          </LazyLoader>
        ),
      },
    ],
  },

  // Fallback Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
