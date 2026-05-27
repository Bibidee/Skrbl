/** GET /api/auth/session - returns the wallet that's currently signed in, or null. */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ walletAddress: null });
  return NextResponse.json({
    walletAddress: session.walletAddress,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}
