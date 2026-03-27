export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { serve } from 'inngest/next';
import { inngest, inngestFunctions } from '@/lib/jobs/inngest';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
