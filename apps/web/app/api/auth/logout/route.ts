/** POST /api/auth/logout - clears the WordCourt session cookie. */
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/jwt';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' });
  return res;
}
