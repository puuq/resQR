import { z } from 'zod';
import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database, id } from '@/lib/db';
import { menuInput } from '@/lib/validation';
export const POST = handler(async (request) => {
  const user = await requireUser();
  const raw = await body(request);
  const rid = z.string().min(1).parse(raw.restaurant_id);
  access(user, rid, true);
  const data = menuInput.parse(raw);
  const db = await database();
  if (raw.id) {
    const result = await db
      .prepare(
        'UPDATE menu_items SET name=?,category=?,description=?,price=?,available=?,vegetarian=?,image=?,sort_order=? WHERE id=? AND restaurant_id=?',
      )
      .bind(
        data.name,
        data.category,
        data.description,
        data.price,
        +data.available,
        +data.vegetarian,
        data.image,
        data.sort_order,
        z.string().parse(raw.id),
        rid,
      )
      .run();
    if (!result.meta.changes) throw new ApiError(404, 'Menu item not found.');
  } else
    await db
      .prepare(
        'INSERT INTO menu_items(id,restaurant_id,name,category,description,price,available,vegetarian,image,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id(),
        rid,
        data.name,
        data.category,
        data.description,
        data.price,
        +data.available,
        +data.vegetarian,
        data.image,
        data.sort_order,
      )
      .run();
  return json({ ok: true });
});
export const DELETE = handler(async (request) => {
  const user = await requireUser();
  const raw = await body(request);
  const rid = z.string().parse(raw.restaurant_id);
  access(user, rid, true);
  await (
    await database()
  )
    .prepare('DELETE FROM menu_items WHERE id=? AND restaurant_id=?')
    .bind(z.string().parse(raw.id), rid)
    .run();
  return json({ ok: true });
});
