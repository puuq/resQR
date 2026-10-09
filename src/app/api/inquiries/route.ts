import { z } from 'zod';
import { ApiError, body, handler, ip, json, rateLimit, requireUser } from '@/lib/api';
import { database } from '@/lib/db';

export const dynamic = 'force-dynamic';
const inquiryInput = z.object({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  restaurant: z.string().trim().min(2, 'Please enter your restaurant or café name.').max(100),
  location: z.string().trim().min(2, 'Please enter your city or area.').max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^\+?[\d ()-]+$/, 'Enter a valid phone number.')
    .refine((value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }, 'Enter a valid phone number.'),
  email: z.union([z.literal(''), z.email().max(254)]).default(''),
  message: z.string().trim().max(1000).default(''),
  website: z.string().max(200).default(''),
});

export const POST = handler(async (request) => {
  const data = inquiryInput.parse(await body(request));
  await rateLimit(`inquiry:${ip(request)}`, 5, 60 * 60000);
  // Bots filling the off-screen field receive the same response without saving a lead.
  if (!data.website) {
    await (
      await database()
    )
      .prepare(
        'INSERT INTO setup_inquiries(name,restaurant,location,phone,email,message,created_at) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        data.name,
        data.restaurant,
        data.location,
        data.phone,
        data.email,
        data.message,
        Date.now(),
      )
      .run();
  }
  return json({ ok: true }, 201);
});

async function platformUser() {
  if ((await requireUser()).role !== 'platform')
    throw new ApiError(403, 'Only the platform administrator can view setup requests.');
}

export const GET = handler(async (request) => {
  await platformUser();
  const cursor = new URL(request.url).searchParams.get('before');
  const before =
    cursor === null
      ? Number.MAX_SAFE_INTEGER
      : z.coerce.number().int().positive().safe().parse(cursor);
  const db = await database();
  const [rows, count] = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT * FROM setup_inquiries WHERE id<? ORDER BY id DESC LIMIT 51').bind(before),
    db.prepare("SELECT COUNT(*) AS total FROM setup_inquiries WHERE status='new'"),
  ]);
  const inquiries = rows.results.slice(0, 50);
  return json({
    inquiries,
    newCount: Number(count.results[0]?.total || 0),
    nextCursor: rows.results.length > 50 ? Number(inquiries[inquiries.length - 1].id) : null,
  });
});

export const PATCH = handler(async (request) => {
  await platformUser();
  const data = z
    .object({ id: z.number().int().positive(), status: z.enum(['new', 'contacted']) })
    .parse(await body(request));
  const result = await (
    await database()
  )
    .prepare('UPDATE setup_inquiries SET status=? WHERE id=?')
    .bind(data.status, data.id)
    .run();
  if (!result.meta.changes) throw new ApiError(404, 'Setup request not found.');
  return json({ ok: true });
});
