import { z } from 'zod';
import { access, ApiError, body, handler, ip, json, rateLimit, requireUser } from '@/lib/api';
import { database, digest, id } from '@/lib/db';
import type { DiningTable, ServiceRequest } from '@/lib/types';
export const dynamic = 'force-dynamic';
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid table link.');
export const GET = handler(async (request) => {
  const params = new URL(request.url).searchParams;
  const db = await database();
  if (params.has('table')) {
    const tableToken = tokenSchema.parse(params.get('table'));
    const table = await db
      .prepare('SELECT id,is_shared FROM dining_tables WHERE token=?')
      .bind(tableToken)
      .first<{ id: string; is_shared: number }>();
    if (!table) throw new ApiError(404, 'Table not found.');
    const guest = table.is_shared ? await digest(tokenSchema.parse(params.get('guest'))) : '';
    const call = await db
      .prepare(
        'SELECT id,status,created_at,acknowledged_at,completed_at FROM service_requests WHERE table_id=? AND guest_key=? ORDER BY created_at DESC LIMIT 1',
      )
      .bind(table.id, guest)
      .first();
    return json({ call });
  }
  const user = await requireUser();
  const rid = params.get('restaurant') || user.restaurant_id || '';
  access(user, rid);
  const calls = await db
    .prepare(
      `SELECT s.*,t.is_shared,CASE WHEN t.is_shared=1 THEN 'Guest request' ELSE t.label END AS table_label,u.name AS staff_name FROM service_requests s JOIN dining_tables t ON t.id=s.table_id LEFT JOIN users u ON u.id=s.assigned_to WHERE s.restaurant_id=? AND (s.status!='completed' OR s.completed_at>?) ORDER BY CASE WHEN s.status='completed' THEN 1 ELSE 0 END, s.created_at DESC LIMIT 200`,
    )
    .bind(rid, Date.now() - 12 * 3600000)
    .all();
  return json({ calls: calls.results, serverTime: Date.now() });
});
export const POST = handler(async (request) => {
  const raw = z
    .object({ token: tokenSchema, guest: tokenSchema.optional() })
    .parse(await body(request));
  await rateLimit(`call-ip:${ip(request)}`, 120, 60000);
  const db = await database();
  const table = await db
    .prepare('SELECT * FROM dining_tables WHERE token=?')
    .bind(raw.token)
    .first<DiningTable>();
  if (!table) throw new ApiError(404, 'This table link is not valid.');
  if (table.is_shared && !raw.guest)
    throw new ApiError(400, 'Reload the menu to start your guest session.');
  const guest = table.is_shared ? await digest(raw.guest!) : '';
  await rateLimit(`call-table:${raw.token}`, table.is_shared ? 120 : 10, 60000);
  if (table.is_shared) await rateLimit(`call-guest:${raw.token}:${guest}`, 10, 60000);
  const now = Date.now();
  // The partial unique index and conditional INSERT make duplicate taps atomic,
  // including calls made concurrently by different phones at the same table.
  await db
    .prepare(
      `INSERT INTO service_requests(id,table_id,restaurant_id,created_at,guest_key)
    SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM service_requests WHERE table_id=? AND guest_key=? AND (status!='completed' OR completed_at>?))
    ON CONFLICT DO NOTHING`,
    )
    .bind(id(), table.id, table.restaurant_id, now, guest, table.id, guest, now - 30000)
    .run();
  const call = await db
    .prepare(
      'SELECT id,status,created_at,acknowledged_at,completed_at FROM service_requests WHERE table_id=? AND guest_key=? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(table.id, guest)
    .first<ServiceRequest>();
  if (call?.status === 'completed')
    throw new ApiError(
      429,
      'Your last request just finished. Please wait 30 seconds before calling again.',
    );
  return json({ call });
});
export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const data = z
    .object({
      id: z.string(),
      restaurant_id: z.string(),
      status: z.enum(['acknowledged', 'completed']),
    })
    .parse(await body(request));
  access(user, data.restaurant_id);
  const db = await database();
  const call = await db
    .prepare('SELECT * FROM service_requests WHERE id=? AND restaurant_id=?')
    .bind(data.id, data.restaurant_id)
    .first<ServiceRequest>();
  if (!call) throw new ApiError(404, 'Request not found.');
  if (data.status === 'acknowledged') {
    const result = await db
      .prepare(
        "UPDATE service_requests SET status='acknowledged',acknowledged_at=?,assigned_to=? WHERE id=? AND restaurant_id=? AND status='pending'",
      )
      .bind(Date.now(), user.id, data.id, data.restaurant_id)
      .run();
    if (!result.meta.changes)
      throw new ApiError(409, 'Another staff member already handled this request.');
  } else {
    if (user.role === 'waiter' && call.assigned_to !== user.id)
      throw new ApiError(403, 'Only the assigned waiter or reception can complete this request.');
    const result = await db
      .prepare(
        "UPDATE service_requests SET status='completed',completed_at=? WHERE id=? AND restaurant_id=? AND status='acknowledged'",
      )
      .bind(Date.now(), data.id, data.restaurant_id)
      .run();
    if (!result.meta.changes)
      throw new ApiError(409, 'Acknowledge the request before completing it.');
  }
  return json({ ok: true });
});
