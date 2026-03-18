'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const searchParams  = useSearchParams();
  const router        = useRouter();
  const callbackUrl   = searchParams.get('callbackUrl') || '/dashboard';
  const isDemo        = email === 'demo@webgrade.io';

  async function handleCredentialsSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn('google', { callbackUrl });
  }

  function fillDemo() {
    setEmail('demo@webgrade.io');
    setPassword('DemoPass2026!');
    setShowPassword(false);
    // Submit automatically after state has updated
    setTimeout(() => {
      signIn('credentials', {
        email: 'demo@webgrade.io',
        password: 'DemoPass2026!',
        callbackUrl: '/dashboard',
      });
    }, 100);
  }
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">WebGrade</span>
          </div>
          <p className="text-gray-400 text-sm">Website intelligence for founders</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h1 className="text-white font-semibold text-xl mb-1">Sign in</h1>
          <p className="text-gray-400 text-sm mb-7">to your WebGrade dashboard</p>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium py-2.5 px-4 rounded-xl transition-colors mb-5 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-gray-900 text-gray-500">or sign in with email</span>
            </div>
          </div>

          {/* Demo shortcut */}
          <button
            type="button"
            onClick={fillDemo}
            className="w-full flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 mb-5 transition-colors group"
          >
            <div className="text-left">
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-0.5">Demo Account</p>
              <p className="text-gray-300 text-sm">NovaPulse HR — pre-loaded with data</p>
            </div>
            <svg className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>

          {/* Email + password form */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Demo credentials hint */}
            {isDemo && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-emerald-400 text-xs">Demo credentials filled — click Sign in</p>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          By signing in, you agree to our{' '}
          <a href="/terms" className="hover:text-gray-400 transition-colors underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="hover:text-gray-400 transition-colors underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
