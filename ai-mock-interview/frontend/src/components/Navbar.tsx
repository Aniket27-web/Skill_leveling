import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '../api/hooks';
import { useToast } from './Toast';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

export const Navbar: React.FC = () => {
  const { data: user } = useMe();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success('You have been logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'New Session', path: '/sessions/new', icon: <PlusCircle className="w-4 h-4" /> },
    { name: 'History', path: '/history', icon: <History className="w-4 h-4" /> },
    { name: 'Progress', path: '/progress', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 p-0.5 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-teal-400 group-hover:text-emerald-300 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-teal-300 via-emerald-200 to-white bg-clip-text text-transparent">
                  SkillLevel
                </span>
                <span className="text-[10px] text-slate-400 -mt-1 font-medium tracking-wide">
                  AI Mock Interview
                </span>
              </div>
            </NavLink>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  )
                }
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          {/* User profile & Logout */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
                <div className="flex items-center gap-2 text-right">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-white leading-tight">
                      {user.name || user.email.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="Logout"
                  title="Logout"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Responsive down to 375px) */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-b border-slate-800 px-4 pt-2 pb-4 space-y-2 animate-fade-in bg-slate-950/95">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                )
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}

          {user && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-teal-400">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-slate-300 font-medium truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
