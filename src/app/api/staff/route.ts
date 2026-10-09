import { z } from 'zod';
import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database, id } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { credentials } from '@/lib/validation';
export const POST = handler(async (request) => {
  const user = await requireUser();
  const data = credentials
    .extend({
      restaurant_id: z.string(),
      name: z.string().trim().min(2).max(80),
      role: z.enum(['owner', 'receptionist', 'waiter']),
    })
    .parse(await body(request));
  access(user, data.restaurant_id, true);
  const db = await database();
  if (await db.prepare('SELECT id FROM users WHERE email=?').bind(data.email).first())
    throw new ApiError(409, 'This email already has an account.');
  await db
    .prepare(
      'INSERT INTO users(id,email,name,password_hash,role,restaurant_id,created_at) VALUES(?,?,?,?,?,?,?)',
    )
    .bind(
      id(),
      data.email,
      data.name,
      await hashPassword(data.password),
      data.role,
      data.restaurant_id,
      Date.now(),
    )
    .run();
  return json({ ok: true }, 201);
});
