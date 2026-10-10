import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database, id, token } from '@/lib/db';
import { restaurantInput } from '@/lib/validation';
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
  const data = restaurantInput.parse(await body(request));
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
  for (let i = 1; i <= data.table_count; i++)
    statements.push(
      db
        .prepare(
          'INSERT INTO dining_tables(id,restaurant_id,label,token,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(id(), restaurantId, `Table ${i}`, token(), now),
    );
  if (data.sample_menu)
    sampleMenu.forEach((item, index) =>
      statements.push(
        db
          .prepare(
            'INSERT INTO menu_items(id,restaurant_id,category,name,description,price,vegetarian,sort_order) VALUES(?,?,?,?,?,?,?,?)',
          )
          .bind(
            id(),
            restaurantId,
            item.category,
            item.name,
            item.description,
            item.price,
            item.vegetarian,
            index,
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
