import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/with-auth';
import { runAthena } from '@/lib/athena-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [{ role: 'user', content: String(body.message || '') }];
    const safeMessages = messages.filter((message: any) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string').slice(-30);
    if (!safeMessages.length) return NextResponse.json({ error: 'A message is required' }, { status: 400 });
    const result = await runAthena(safeMessages);
    return NextResponse.json({ success: true, message: result.message, usage: result.usage, userId: user.id });
  } catch (error) {
    console.error('Athena request failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Athena request failed' }, { status: 502 });
  }
}
