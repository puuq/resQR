import { ApiError, handler, json } from '@/lib/api';
import { database } from '@/lib/db';
import type { DiningTable, Restaurant } from '@/lib/types';
export const dynamic = 'force-dynamic';
export const GET = handler(async (request) => {
  const params = new URL(request.url).searchParams;
  const db = await database();
  const table = params.get('table')
    ? await db
        .prepare('SELECT * FROM dining_tables WHERE token=?')
        .bind(params.get('table'))
        .first<DiningTable>()
    : null;
  if (params.get('table') && !table)
    throw new ApiError(404, 'This table link is not valid. Please ask a staff member.');
  const restaurant = table
    ? await db
        .prepare('SELECT * FROM restaurants WHERE id=?')
        .bind(table.restaurant_id)
        .first<Restaurant>()
    : await db
        .prepare('SELECT * FROM restaurants WHERE slug=?')
        .bind(params.get('slug') || '')
        .first<Restaurant>();
  if (!restaurant) throw new ApiError(404, 'This restaurant could not be found.');
  const menu = await db
    .prepare('SELECT * FROM menu_items WHERE restaurant_id=? ORDER BY sort_order,name')
    .bind(restaurant.id)
    .all();
  const { wifi_ssid, wifi_password, ...publicRestaurant } = restaurant;
  void wifi_ssid;
  void wifi_password;
  return json({
    restaurant: publicRestaurant,
    table: table ? { label: table.label } : null,
    menu: menu.results,
  });
});
