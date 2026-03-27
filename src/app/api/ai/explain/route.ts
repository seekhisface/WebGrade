export const dynamic = 'force-dynamic'

export async function POST() {
  const { NextResponse } = await import('next/server')
  return NextResponse.json({ explanation: 'Loading...' })
}
