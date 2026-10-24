'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (result?.error) {
          if (result.error.includes('Too many failed login attempts')) {
            setError(result.error);
          } else {
            setError('Invalid email or password.');
          }
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      } catch {
        setError('An unexpected error occurred. Please try again.');
      } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-4 overflow-hidden font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 shadow-xs">
        <div className="flex flex-col items-center mb-8">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/OneAILogo.png" alt="OneAIAssist Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold tracking-tight text-[#1B4B91]">
              OneAIAssist
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome Back
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 text-center font-medium">
            Sign in to access your multi-channel sales pipeline and AI automations.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-700 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium transition"
              placeholder="agent@agency.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1B4B91] hover:bg-[#163e78] text-white font-bold rounded-xl shadow-xs transition-all text-xs disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 font-medium">
          New agency?{' '}
          <Link href="/signup" className="text-[#1B4B91] hover:underline font-bold transition-colors">
            Register Tenant Account
          </Link>
        </div>
      </div>

      {/* Enterprise Security Badge */}
      <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-400 font-medium">
        <span>🔒 AES-256 Encrypted</span>
        <span>•</span>
        <span>Multi-Tenant Isolated</span>
        <span>•</span>
        <span>99.9% Cloud SLA</span>
      </div>
    </div>
  );
}
