'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
  };

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      redirect: false,
      email: 'demo@webgrade.io',
      password: 'DemoPass2026!',
    });
    setLoading(false);
    if (res?.error) {
      setError('Demo account unavailable.');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block mb-3">
            <Image src="/logos/webgrade_logo_light.svg" alt="WebGrade" width={240} height={44} className="h-10 w-auto" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#bae6fd] rounded-3xl p-8 shadow-sm">
          <h1 className="text-[#0c4a6e] font-black text-xl mb-1">Sign into your WebGrade dashboard</h1>
          <p className="text-[#64748b] text-sm mb-7">Setup in minutes · Cancel anytime</p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f0f9ff] border border-[#bae6fd] text-[#0c4a6e] font-medium py-2.5 px-4 rounded-xl transition-colors mb-5 disabled:opacity-50 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#e0f2fe]" />
            <span className="text-xs text-[#94a3b8]">or sign in with email</span>
            <div className="flex-1 h-px bg-[#e0f2fe]" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0c4a6e] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-[#1e293b] text-sm placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent transition"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#0c4a6e]">Password</label>
                <Link href="/forgot-password" className="text-xs text-[#0891b2] hover:underline">Forgot password?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-[#f8fafc] border border-[#bae6fd] rounded-xl text-[#1e293b] text-sm placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0891b2] focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#0c4a6e] hover:bg-[#075985] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#64748b] mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#0891b2] font-semibold hover:underline">Create an account</Link>
          </p>

          <p className="text-center text-xs text-[#94a3b8] mt-4">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-[#0891b2] hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-[#0891b2] hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        {/* Back link */}
        <p className="text-center text-xs text-[#94a3b8] mt-6">
          <Link href="/" className="hover:text-[#0c4a6e] transition-colors">← Back to WebGrade.io</Link>
        </p>

      </div>
    </div>
  );
}
