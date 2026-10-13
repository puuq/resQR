import type { MenuShowcase } from './types';

export async function readShowcases(db: D1Database, restaurantId: string) {
  const [sections, links] = await db.batch([
    db
      .prepare(
        'SELECT slot,title,description,enabled FROM menu_showcases WHERE restaurant_id=? ORDER BY slot',
      )
      .bind(restaurantId),
    db
      .prepare(
        'SELECT slot,item_id FROM menu_showcase_items WHERE restaurant_id=? ORDER BY slot,sort_order',
      )
      .bind(restaurantId),
  ]);
  const rows = sections.results as {
    slot: 1 | 2;
    title: string;
    description: string;
    enabled: number;
  }[];
  const memberships = links.results as { slot: 1 | 2; item_id: string }[];
  return rows.map((row) => ({
    slot: row.slot,
    title: row.title,
    description: row.description,
    enabled: !!row.enabled,
    item_ids: memberships.filter((link) => link.slot === row.slot).map((link) => link.item_id),
  })) as MenuShowcase[];
}
