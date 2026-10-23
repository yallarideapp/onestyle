-- Private integration settings, separate from the public shop content and its exports.
CREATE TABLE telegram_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  bot_username TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_result TEXT NOT NULL DEFAULT '',
  last_attempt_at TEXT NOT NULL DEFAULT ''
);
