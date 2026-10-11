import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database, id, token } from '@/lib/db';
import { restaurantInput, restaurantCreateInput } from '@/lib/validation';
import { sampleMenu } from '@/lib/sample-menu';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const user = await requireUser();
  const db = await database();
  const result = await db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM dining_tables t WHERE t.restaurant_id=r.id) AS table_count, (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id=r.id) AS item_count, (SELECT COUNT(*) FROM service_requests s WHERE s.restaurant_id=r.id AND status!='completed') AS open_requests FROM restaurants r ${user.role === 'platform' ? '' : 'WHERE r.id=?'} ORDER BY r.created_at DESC`,
    )
    .bind(...(user.role === 'platform' ? [] : [user.restaurant_id]))
    .all();
  return json({ restaurants: result.results });
});
export const POST = handler(async (request) => {
  const user = await requireUser();
  if (user.role !== 'platform')
    throw new ApiError(403, 'Only the platform administrator can create restaurants.');
  const data = restaurantCreateInput.parse(await body(request, 300000));
  const db = await database();
  if (await db.prepare('SELECT id FROM restaurants WHERE slug=?').bind(data.slug).first())
    throw new ApiError(409, 'This URL is already in use. Choose another.');
  const restaurantId = id();
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO restaurants(id,name,slug,tagline,address,color,theme,logo,wifi_ssid,wifi_password,ad_title,ad_image,ad_url,google_review_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        restaurantId,
        data.name,
        data.slug,
        data.tagline,
        data.address,
        data.color,
        data.theme,
        data.logo,
        data.wifi_ssid,
        data.wifi_password,
        data.ad_title,
        data.ad_image,
        data.ad_url,
        data.google_review_url,
        now,
      ),
  ];
  // JSON rowsets keep even 100 tables + 200 dishes below D1's free-plan query limit.
  statements.push(
    db
      .prepare(
        `INSERT INTO dining_tables(id,restaurant_id,label,token,created_at)
    SELECT json_extract(value,'$.id'), ?, json_extract(value,'$.label'),
      json_extract(value,'$.token'), ? FROM json_each(?)`,
      )
      .bind(
        restaurantId,
        now,
        JSON.stringify(
          Array.from({ length: data.table_count }, (_, i) => ({
            id: id(),
            label: `Table ${i + 1}`,
            token: token(),
          })),
        ),
      ),
  );
  const menu = data.imported_menu.length ? data.imported_menu : data.sample_menu ? sampleMenu : [];
  if (menu.length)
    statements.push(
      db
        .prepare(
          `INSERT INTO menu_items
    (id,restaurant_id,category,name,description,price,vegetarian,available,image,sort_order)
    SELECT json_extract(value,'$.id'), ?, json_extract(value,'$.category'),
      json_extract(value,'$.name'), json_extract(value,'$.description'),
      json_extract(value,'$.price'), json_extract(value,'$.vegetarian'),
      json_extract(value,'$.available'), json_extract(value,'$.image'),
      CAST(key AS INTEGER) FROM json_each(?)`,
        )
        .bind(
          restaurantId,
          JSON.stringify(
            menu.map((item) => ({
              ...item,
              id: id(),
              vegetarian: item.vegetarian ? 1 : 0,
              available: 'available' in item && !item.available ? 0 : 1,
              image: 'image' in item ? item.image : '',
            })),
          ),
        ),
    );
  await db.batch(statements);
  return json({ id: restaurantId }, 201);
});
export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const raw = await body(request);
  if (typeof raw.id !== 'string') throw new ApiError(400, 'Choose a restaurant.');
  access(user, raw.id, true);
  const data = restaurantInput.parse(raw);
  const db = await database();
  // Sponsorship is managed centrally; restaurant owners cannot replace platform ads.
  const previous = await db
    .prepare('SELECT ad_title,ad_image,ad_url,google_review_url FROM restaurants WHERE id=?')
    .bind(raw.id)
    .first<{ ad_title: string; ad_image: string; ad_url: string; google_review_url: string }>();
  if (!previous) throw new ApiError(404, 'Restaurant not found.');
  const ad = user.role === 'platform' ? data : previous;
  const reviewUrl =
    raw.google_review_url === undefined ? previous.google_review_url : data.google_review_url;
  if (
    await db
      .prepare('SELECT id FROM restaurants WHERE slug=? AND id!=?')
      .bind(data.slug, raw.id)
      .first()
  )
    throw new ApiError(409, 'This URL is already in use.');
  await db
    .prepare(
      `UPDATE restaurants SET name=?,slug=?,tagline=?,address=?,color=?,theme=?,logo=?,wifi_ssid=?,wifi_password=?,ad_title=?,ad_image=?,ad_url=?,google_review_url=? WHERE id=?`,
    )
    .bind(
      data.name,
      data.slug,
      data.tagline,
      data.address,
      data.color,
      data.theme,
      data.logo,
      data.wifi_ssid,
      data.wifi_password,
      ad.ad_title,
      ad.ad_image,
      ad.ad_url,
      reviewUrl,
      raw.id,
    )
    .run();
  return json({ ok: true });
});
