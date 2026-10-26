import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  Shield,
  UserCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Server,
} from 'lucide-react';
import { useApp, DEMO_ACCOUNTS, DemoAccount } from '../../context/AppContext';

export const LoginPage: React.FC = () => {
  const { login } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemoAccount = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword('Password123!');
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(account.email, 'Password123!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed for selected demo account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-3">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          EduVerify Portal
        </h1>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          AICTE APAAR Student Registry & Role-Based Access Control
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-5 sm:px-10 shadow-xl shadow-slate-200/50 rounded-xl border border-slate-200">
          {/* Header Description */}
          <div className="border-b border-slate-100 pb-4 mb-6 text-center">
            <h2 className="text-base font-semibold text-slate-900">
              Sign In to Your Authorized Account
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Backend validates your credentials against PostgreSQL. Role and institution clearance are issued strictly via signed JWT.
            </p>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. inst1@nitdelhi.ac.in or reviewer@aicte-india.org"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Demo: Password123!</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials with PostgreSQL...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Role Selectors */}
          <div className="mt-7 pt-5 border-t border-slate-100">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Instant Demo Account Sign-in
                </span>
                <span className="text-[10px] text-blue-600 font-medium">1-click test roles</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Click any role below to authenticate instantly with its PostgreSQL account and signed JWT.
              </p>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const getRoleIcon = () => {
                  if (acc.role === 'INSTITUTION_MEMBER') return Building2;
                  if (acc.role === 'REGULATORY_REVIEWER') return Shield;
                  return Server;
                };
                const Icon = getRoleIcon();

                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectDemoAccount(acc)}
                    disabled={isSubmitting}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-slate-100 group-hover:bg-blue-100 text-slate-600 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {acc.label}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                            {acc.badge}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {acc.email}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security / Privacy notice */}
        <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
          <p>
            Zero-Trust Architecture · Passwords hashed with bcrypt · Signed JWT bearer tokens
          </p>
          <p className="text-[11px] text-slate-400">
            All records displayed are 100% synthetic fictional data created for prototype evaluation.
          </p>
        </div>
      </div>
    </div>
  );
};
