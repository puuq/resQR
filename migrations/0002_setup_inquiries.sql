CREATE TABLE setup_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  restaurant TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted')),
  created_at INTEGER NOT NULL
);
CREATE INDEX inquiries_status ON setup_inquiries(status, id DESC);
