import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../api/hooks';
import { Navbar } from '../components/Navbar';
import { Spinner } from '../components/Spinner';

export const ProtectedRoute: React.FC = () => {
  const { data: user, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-slate-400 font-medium animate-pulse">
          Authenticating session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
};
