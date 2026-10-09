import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentUser } from './auth';
import { database, digest } from './db';
import type { User } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function handler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin');
        // Next can use its internal bind address in request.url. Compare against
        // the actual HTTP Host so localhost/custom-domain requests remain valid.
        const host = request.headers.get('host') || new URL(request.url).host;
        if (origin && new URL(origin).host !== host)
          throw new ApiError(403, 'This request came from another site. Refresh and try again.');
      }
      return await fn(request);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      if (error instanceof ZodError)
        return json({ error: error.issues[0]?.message || 'Check the supplied details.' }, 400);
      if (error instanceof SyntaxError) return json({ error: 'Invalid request body.' }, 400);
      console.error('API failure', error instanceof Error ? error.message : 'Unknown error');
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}
export async function body(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 100000)
    throw new ApiError(413, 'Request is too large.');
  const text = await request.text();
  if (text.length > 100000) throw new ApiError(413, 'Request is too large.');
  return JSON.parse(text);
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, 'Please sign in to continue.');
  return user;
}
export function access(user: User, restaurantId: string, management = false) {
  if (user.role === 'platform') return;
  if (user.restaurant_id !== restaurantId || (management && user.role !== 'owner'))
    throw new ApiError(403, 'You do not have access to this restaurant.');
}
export async function rateLimit(key: string, limit: number, milliseconds: number) {
  const db = await database();
  const hashed = await digest(key);
  const now = Date.now();
  const row = await db
    .prepare(
      `INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`,
    )
    .bind(hashed, now + milliseconds, now, now)
    .first<{ count: number }>();
  if (row && row.count > limit)
    throw new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.');
  // Bounded opportunistic cleanup avoids unbounded growth without a scheduled worker.
  await db
    .prepare(
      'DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at<? LIMIT 50)',
    )
    .bind(now)
    .run();
}
export function ip(request: Request) {
  return request.headers.get('cf-connecting-ip') || 'local';
}
