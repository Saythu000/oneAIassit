'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 2FA removed: no totpSecret state

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTenantName(val);
    setTenantSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // remove special chars
        .trim()
        .replace(/\s+/g, '-') // spaces to hyphens
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantName, tenantSlug, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
      } else {
        // Registration succeeded, proceed to login
        router.push('/login');
      }
    } catch {
      setError('An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-4 overflow-hidden font-sans py-12">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 shadow-xs">
        <div className="flex flex-col items-center mb-6">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/OneAILogo.png" alt="OneAIAssist Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold tracking-tight text-[#1B4B91]">
              OneAIAssist
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Agency Account
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 text-center font-medium">
            Setup your dedicated tenant space and provision your primary workspace.
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
              Agency / Organization Name
            </label>
            <input
              type="text"
              required
              value={tenantName}
              onChange={handleNameChange}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium transition"
              placeholder="e.g. Apex Assurance Group"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Workspace Identifier (Slug)
            </label>
            <input
              type="text"
              required
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium transition"
              placeholder="apex-assurance"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Admin Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1B4B91] focus:bg-white text-xs font-medium transition"
              placeholder="admin@agency.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
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
            {loading ? 'Registering Workspace...' : 'Create Agency Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 font-medium">
          Already registered?{' '}
          <Link href="/login" className="text-[#1B4B91] hover:underline font-bold transition-colors">
            Sign In here
          </Link>
        </div>
      </div>

      {/* Enterprise Security Badge */}
      <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-400 font-medium">
        <span>🔒 AES-256 Encrypted</span>
        <span>•</span>
        <span>SOC-2 Compliant Storage</span>
        <span>•</span>
        <span>No Credit Card Required</span>
      </div>
    </div>
  );
}
