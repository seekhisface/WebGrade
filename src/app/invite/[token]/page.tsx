'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

export default function AcceptInvitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<{ orgName: string; email: string; role: string; inviterName: string } | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvitation() {
      const res = await fetch(`/api/invite/${token}`);
      if (res.ok) {
        setInvitation(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid or expired invitation');
      }
      setLoading(false);
    }
    loadInvitation();
  }, [token]);

  async function acceptInvite() {
    setAccepting(true);
    const res = await fetch(`/api/invite/${token}`, { method: 'POST' });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to accept invitation');
      setAccepting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0891b2] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Image src="/logos/webgrade_logo_light.svg" alt="WebGrade" width={240} height={44} className="h-10 w-auto mx-auto mb-8" />
        <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
          <h1 className="text-xl font-black text-[#0c4a6e] mb-2">Invitation Error</h1>
          <p className="text-sm text-[#64748b] mb-6">{error}</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-[#0c4a6e] text-white text-sm font-bold rounded-xl">Go to Login</a>
        </div>
      </div>
    </div>
  );

  // Not signed in — prompt to sign in first
  if (status === 'unauthenticated') return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Image src="/logos/webgrade_logo_light.svg" alt="WebGrade" width={240} height={44} className="h-10 w-auto mx-auto mb-8" />
        <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
          <h1 className="text-xl font-black text-[#0c4a6e] mb-2">You&apos;re Invited!</h1>
          <p className="text-sm text-[#64748b] mb-2">
            You&apos;ve been invited to join <strong>{invitation?.orgName}</strong> on WebGrade as a <strong>{invitation?.role?.toLowerCase()}</strong>.
          </p>
          <p className="text-sm text-[#64748b] mb-6">Sign in or create an account to accept this invitation.</p>
          <button
            onClick={() => signIn('google', { callbackUrl: `/invite/${token}` })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f0f9ff] border border-[#bae6fd] text-[#0c4a6e] font-medium py-2.5 px-4 rounded-xl transition-colors mb-3 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <a href="/login" className="text-xs text-[#0891b2] hover:underline">Or sign in with email</a>
        </div>
      </div>
    </div>
  );

  // Signed in — show accept button
  return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Image src="/logos/webgrade_logo_light.svg" alt="WebGrade" width={240} height={44} className="h-10 w-auto mx-auto mb-8" />
        <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
          <h1 className="text-xl font-black text-[#0c4a6e] mb-2">Accept Invitation</h1>
          <p className="text-sm text-[#64748b] mb-6">
            Join <strong>{invitation?.orgName}</strong> as a <strong>{invitation?.role?.toLowerCase()}</strong>.
            You&apos;ll get access to all their sites and reports.
          </p>
          <button
            onClick={acceptInvite}
            disabled={accepting}
            className="w-full px-6 py-3 bg-[#0c4a6e] hover:bg-[#075985] text-white font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {accepting ? 'Accepting...' : 'Accept & Go to Dashboard'}
          </button>
          <p className="text-xs text-[#94a3b8] mt-4">Signed in as {session?.user?.email}</p>
        </div>
      </div>
    </div>
  );
}
