import { access, ApiError, handler, json, requireUser } from '@/lib/api';
import { database, environment } from '@/lib/db';
import type { Restaurant } from '@/lib/types';
export const dynamic = 'force-dynamic';
export const GET = handler(async (request) => {
  const user = await requireUser();
  const rid = new URL(request.url).searchParams.get('restaurant') || user.restaurant_id || '';
  access(user, rid);
  const db = await database();
  const restaurant = await db
    .prepare('SELECT * FROM restaurants WHERE id=?')
    .bind(rid)
    .first<Restaurant>();
  if (!restaurant) throw new ApiError(404, 'Restaurant not found.');
  const [tables, menu, staff] = await db.batch([
    db
      .prepare('SELECT * FROM dining_tables WHERE restaurant_id=? ORDER BY created_at,label')
      .bind(rid),
    db.prepare('SELECT * FROM menu_items WHERE restaurant_id=? ORDER BY sort_order,name').bind(rid),
    db
      .prepare(
        'SELECT id,name,email,role,restaurant_id FROM users WHERE restaurant_id=? ORDER BY name',
      )
      .bind(rid),
  ]);
  const env = await environment();
  return json({
    restaurant,
    tables: tables.results,
    menu: menu.results,
    staff: user.role === 'waiter' ? [] : staff.results,
    qrBaseUrl: env.QR_BASE_URL || new URL(request.url).origin,
  });
});
