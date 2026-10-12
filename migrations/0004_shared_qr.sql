-- Existing numbered-table tokens and calls remain unchanged.
ALTER TABLE dining_tables ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0 CHECK(is_shared IN (0,1));
CREATE UNIQUE INDEX one_shared_qr ON dining_tables(restaurant_id) WHERE is_shared=1;
ALTER TABLE service_requests ADD COLUMN guest_key TEXT NOT NULL DEFAULT '';
DROP INDEX one_active_request;
CREATE UNIQUE INDEX one_active_request ON service_requests(table_id,guest_key) WHERE status!='completed';
CREATE INDEX requests_guest ON service_requests(table_id,guest_key,created_at DESC);

INSERT INTO dining_tables(id,restaurant_id,label,token,created_at,is_shared)
SELECT lower(hex(randomblob(16))),id,'__shared_' || lower(hex(randomblob(12))),
  lower(hex(randomblob(32))),created_at,1 FROM restaurants;
