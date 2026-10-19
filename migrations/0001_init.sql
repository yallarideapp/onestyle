-- One Style: first schema for the live site. Money is stored in fils (1 JOD = 1000 fils).
CREATE TABLE content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO counters (name, value) VALUES ('order', 1000);

CREATE TABLE customers (
  id TEXT PRIMARY KEY CHECK (length(id) = 32),
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL CHECK (length(password_hash) = 64),
  salt TEXT NOT NULL CHECK (length(salt) = 32),
  iterations INTEGER NOT NULL CHECK (iterations BETWEEN 10000 AND 100000),
  generation INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX customer_sessions_by_customer ON customer_sessions (customer_id);
CREATE INDEX customer_sessions_by_expiry ON customer_sessions (expires_at);

CREATE TABLE orders (
  number TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  fulfilment TEXT NOT NULL,
  lang TEXT NOT NULL,
  subtotal_fils INTEGER NOT NULL,
  shipping_fils INTEGER NOT NULL,
  total_fils INTEGER NOT NULL,
  customer_id TEXT REFERENCES customers(id)
);
CREATE INDEX orders_by_date ON orders (seq DESC);
CREATE INDEX orders_by_customer ON orders (customer_id, seq DESC);
CREATE TABLE order_lines (
  order_number TEXT NOT NULL,
  position INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variant TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_fils INTEGER NOT NULL,
  PRIMARY KEY (order_number, position)
);

CREATE TABLE admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  generation INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  generation INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- One-time password-reset links (shoppers and the admin). Only the hash of a token is kept.
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  kind TEXT NOT NULL CHECK (kind IN ('customer', 'admin')),
  account_id TEXT NOT NULL,
  generation INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX password_resets_by_account ON password_resets (kind, account_id);

CREATE TABLE attempts (key TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX attempts_by_key ON attempts (key, at);
