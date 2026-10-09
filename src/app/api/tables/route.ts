import { z } from 'zod';
import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database, id, token } from '@/lib/db';
export const POST = handler(async (request) => {
  const user = await requireUser();
  const raw = z
    .object({
      restaurant_id: z.string(),
      label: z.string().trim().min(1).max(40),
      id: z.string().optional(),
    })
    .parse(await body(request));
  access(user, raw.restaurant_id, true);
  const db = await database();
  if (
    await db
      .prepare('SELECT id FROM dining_tables WHERE restaurant_id=? AND label=? AND id!=?')
      .bind(raw.restaurant_id, raw.label, raw.id || '')
      .first()
  )
    throw new ApiError(409, 'A table already has this name.');
  if (raw.id)
    await db
      .prepare('UPDATE dining_tables SET label=? WHERE id=? AND restaurant_id=?')
      .bind(raw.label, raw.id, raw.restaurant_id)
      .run();
  else {
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM dining_tables WHERE restaurant_id=?')
      .bind(raw.restaurant_id)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 100)
      throw new ApiError(400, 'The pilot supports up to 100 tables per restaurant.');
    await db
      .prepare(
        'INSERT INTO dining_tables(id,restaurant_id,label,token,created_at) VALUES(?,?,?,?,?)',
      )
      .bind(id(), raw.restaurant_id, raw.label, token(), Date.now())
      .run();
  }
  return json({ ok: true });
});
