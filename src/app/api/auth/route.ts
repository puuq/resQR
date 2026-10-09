import { z } from 'zod';
import {
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { ApiError, body, handler, ip, json, rateLimit } from '@/lib/api';
import { database, digest, environment, id } from '@/lib/db';
import { credentials } from '@/lib/validation';
import type { User } from '@/lib/types';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => json({ user: await currentUser() }));
export const DELETE = handler(async () => {
  await destroySession();
  return json({ ok: true });
});
export const POST = handler(async (request) => {
  await rateLimit(`login:${ip(request)}`, 20, 15 * 60000);
  const data = await body(request);
  const { email, password } = credentials.parse(data);
  await rateLimit(`account:${email}`, 10, 15 * 60000);
  const db = await database();
  if (data.action === 'setup') {
    const env = await environment();
    if (
      !env.BOOTSTRAP_TOKEN ||
      typeof data.token !== 'string' ||
      (await digest(data.token)) !== (await digest(env.BOOTSTRAP_TOKEN))
    )
      throw new ApiError(403, 'The setup token is incorrect.');
    if (await db.prepare("SELECT id FROM users WHERE role='platform'").first())
      throw new ApiError(409, 'The platform account is already set up. Please sign in.');
    const name = z.string().trim().min(2).max(80).parse(data.name);
    const userId = id();
    await db
      .prepare(
        "INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'platform',?)",
      )
      .bind(userId, email, name, await hashPassword(password), Date.now())
      .run();
    await createSession(userId, new URL(request.url).protocol === 'https:');
    return json({ user: { id: userId, email, name, role: 'platform', restaurant_id: null } }, 201);
  }
  const user = await db
    .prepare('SELECT * FROM users WHERE email=?')
    .bind(email)
    .first<User & { password_hash: string }>();
  const fallback = 'pbkdf2$100000$00000000000000000000000000000000$' + '0'.repeat(64);
  if (!(await verifyPassword(password, user?.password_hash || fallback)) || !user)
    throw new ApiError(401, 'Email or password is incorrect.');
  await createSession(user.id, new URL(request.url).protocol === 'https:');
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurant_id: user.restaurant_id,
    },
  });
});
