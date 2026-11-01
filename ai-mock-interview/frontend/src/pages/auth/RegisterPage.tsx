import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegister } from '../../api/hooks';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { Bot, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const registerMutation = useRegister();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = (): boolean => {
    const errors: { name?: string; email?: string; password?: string } = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      toast.success('Account created! Welcome to SkillLevel.');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please check your information.';
      setServerError(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-xl shadow-teal-500/20 inline-flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Bot className="w-8 h-8 text-teal-400" />
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-white tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Level up your technical interviewing skills today
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800 bg-slate-900/80">
          {serverError && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start gap-3 text-rose-300 text-sm animate-fade-in"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (clientErrors.name) setClientErrors({ ...clientErrors, name: undefined });
                  }}
                  placeholder="Alex Johnson"
                  className={`w-full rounded-lg bg-slate-950/80 border ${
                    clientErrors.name ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-teal-500'
                  } pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors`}
                />
              </div>
              {clientErrors.name && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{clientErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (clientErrors.email) setClientErrors({ ...clientErrors, email: undefined });
                  }}
                  placeholder="alex.developer@example.com"
                  className={`w-full rounded-lg bg-slate-950/80 border ${
                    clientErrors.email ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-teal-500'
                  } pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors`}
                />
              </div>
              {clientErrors.email && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{clientErrors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-slate-500">Min. 8 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (clientErrors.password) setClientErrors({ ...clientErrors, password: undefined });
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-lg bg-slate-950/80 border ${
                    clientErrors.password ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-teal-500'
                  } pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors`}
                />
              </div>
              {clientErrors.password && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{clientErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-3"
              isLoading={registerMutation.isPending}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-teal-400 hover:text-teal-300 underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
