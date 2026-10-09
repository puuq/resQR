PRAGMA foreign_keys = ON;

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#285847',
  theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light','dark')),
  logo TEXT NOT NULL DEFAULT '',
  wifi_ssid TEXT NOT NULL DEFAULT '',
  wifi_password TEXT NOT NULL DEFAULT '',
  ad_title TEXT NOT NULL DEFAULT '',
  ad_image TEXT NOT NULL DEFAULT '',
  ad_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('platform','owner','receptionist','waiter')),
  restaurant_id TEXT REFERENCES restaurants(id),
  created_at INTEGER NOT NULL,
  CHECK ((role = 'platform' AND restaurant_id IS NULL) OR (role != 'platform' AND restaurant_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_platform_admin ON users(role) WHERE role = 'platform';
CREATE INDEX users_restaurant ON users(restaurant_id);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE dining_tables (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  label TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  UNIQUE(restaurant_id,label)
);
CREATE INDEX tables_restaurant ON dining_tables(restaurant_id);
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL CHECK(price >= 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
  vegetarian INTEGER NOT NULL DEFAULT 0 CHECK(vegetarian IN (0,1)),
  image TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX menu_restaurant ON menu_items(restaurant_id,sort_order);
CREATE TABLE service_requests (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES dining_tables(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','acknowledged','completed')),
  created_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  completed_at INTEGER,
  assigned_to TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX one_active_request ON service_requests(table_id) WHERE status != 'completed';
CREATE INDEX requests_queue ON service_requests(restaurant_id,status,created_at);
CREATE INDEX requests_table ON service_requests(table_id,created_at DESC);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
