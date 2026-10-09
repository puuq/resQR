import { cookies } from 'next/headers';
import { database, digest, token } from './db';
import type { User } from './types';

const SESSION = 'resqr_session';
export async function hashPassword(password: string, salt = token().slice(0, 32)) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 },
    key,
    256,
  );
  return `pbkdf2$100000$${salt}$${Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || parts[1] !== '100000') return false;
  const candidate = await hashPassword(password, parts[2]);
  let diff = candidate.length ^ stored.length;
  for (let i = 0; i < candidate.length; i++)
    diff |= candidate.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
export async function currentUser(): Promise<User | null> {
  const session = (await cookies()).get(SESSION)?.value;
  if (!session || !/^[a-f0-9]{64}$/.test(session)) return null;
  const db = await database();
  return db
    .prepare(
      `SELECT u.id,u.email,u.name,u.role,u.restaurant_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .bind(await digest(session), Date.now())
    .first<User>();
}
export async function createSession(userId: string, secure: boolean) {
  const db = await database();
  const value = token();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    db
      .prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .bind(await digest(value), userId, Date.now() + 7 * 86400000),
  ]);
  (await cookies()).set(SESSION, value, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400,
  });
}
export async function destroySession() {
  const jar = await cookies();
  const value = jar.get(SESSION)?.value;
  if (value)
    await (
      await database()
    )
      .prepare('DELETE FROM sessions WHERE token_hash=?')
      .bind(await digest(value))
      .run();
  jar.delete(SESSION);
}
