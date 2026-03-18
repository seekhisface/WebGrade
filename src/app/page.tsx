// Root redirect — logged-in users go to dashboard, others see landing page
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/dashboard');
  }
  // Non-authenticated users see the marketing landing page
  redirect('/marketing');
}
