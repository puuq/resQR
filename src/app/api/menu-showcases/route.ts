import { z } from 'zod';
import { access, ApiError, body, handler, json, requireUser } from '@/lib/api';
import { database } from '@/lib/db';

const sectionInput = z
  .object({
    slot: z.union([z.literal(1), z.literal(2)]),
    title: z.string().trim().min(1, 'Give each highlight a title.').max(60),
    description: z.string().trim().max(200).default(''),
    enabled: z.boolean(),
    item_ids: z.array(z.string().min(1).max(100)).max(12, 'Choose up to 12 dishes per highlight.'),
  })
  .superRefine((section, ctx) => {
    if (section.enabled && !section.item_ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Choose at least one dish for an enabled highlight.',
      });
    if (new Set(section.item_ids).size !== section.item_ids.length)
      ctx.addIssue({ code: 'custom', message: 'Choose each dish only once per highlight.' });
  });

export const PUT = handler(async (request) => {
  const user = await requireUser();
  const raw = await body(request);
  const rid = z.string().min(1).parse(raw.restaurant_id);
  access(user, rid, true);
  const sections = z
    .array(sectionInput)
    .length(2)
    .refine(
      (value) => new Set(value.map((section) => section.slot)).size === 2,
      'Provide both highlight sections.',
    )
    .parse(raw.showcases);
  const db = await database();
  if (!(await db.prepare('SELECT id FROM restaurants WHERE id=?').bind(rid).first()))
    throw new ApiError(404, 'Restaurant not found.');
  const menu = await db
    .prepare('SELECT id FROM menu_items WHERE restaurant_id=?')
    .bind(rid)
    .all<{ id: string }>();
  const ownItems = new Set(menu.results.map((item) => item.id));
  if (sections.some((section) => section.item_ids.some((item) => !ownItems.has(item))))
    throw new ApiError(
      400,
      'A selected dish is no longer on this restaurant’s menu. Refresh and try again.',
    );
  // One transaction replaces both sections; tenant foreign keys also guard concurrent menu changes.
  await db.batch([
    db.prepare('DELETE FROM menu_showcase_items WHERE restaurant_id=?').bind(rid),
    ...sections.flatMap((section) => [
      db
        .prepare(
          `INSERT INTO menu_showcases(restaurant_id,slot,title,description,enabled) VALUES(?,?,?,?,?)
        ON CONFLICT(restaurant_id,slot) DO UPDATE SET title=excluded.title,description=excluded.description,enabled=excluded.enabled`,
        )
        .bind(rid, section.slot, section.title, section.description, +section.enabled),
      ...section.item_ids.map((item, index) =>
        db
          .prepare(
            'INSERT INTO menu_showcase_items(restaurant_id,slot,item_id,sort_order) VALUES(?,?,?,?)',
          )
          .bind(rid, section.slot, item, index),
      ),
    ]),
  ]);
  return json({ ok: true });
});
