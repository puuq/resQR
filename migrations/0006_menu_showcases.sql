CREATE TABLE menu_showcases (
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK(slot IN (1,2)),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  PRIMARY KEY(restaurant_id,slot)
);
CREATE UNIQUE INDEX menu_item_tenant ON menu_items(id,restaurant_id);
CREATE TABLE menu_showcase_items (
  restaurant_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY(restaurant_id,slot,item_id),
  FOREIGN KEY(restaurant_id,slot) REFERENCES menu_showcases(restaurant_id,slot) ON DELETE CASCADE,
  FOREIGN KEY(item_id,restaurant_id) REFERENCES menu_items(id,restaurant_id) ON DELETE CASCADE
);
