export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const { prisma } = await import('@/lib/db/client')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const body = await req.json()
    const { siteId, type, data } = body
    const site = await prisma.site.findFirst({ where: { id: siteId }, select: { name: true, domain: true } })
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: `Explain this ${type} data for ${site?.name}: ${JSON.stringify(data)}. Be concise and actionable in 2-3 sentences.` }]
    })
    const explanation = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ explanation })
  } catch (error) {
    return NextResponse.json({ explanation: 'Unable to generate explanation at this time.' })
  }
}
