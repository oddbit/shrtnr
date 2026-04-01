-- Remove per-user scoping: drop email from api_keys, drop user_preferences table.
-- D1 lacks ALTER TABLE DROP COLUMN, so we recreate the table.

CREATE TABLE api_keys_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

INSERT INTO api_keys_new (id, title, key_prefix, key_hash, scope, created_at, last_used_at)
  SELECT id, title, key_prefix, key_hash, scope, created_at, last_used_at FROM api_keys;

DROP TABLE api_keys;

ALTER TABLE api_keys_new RENAME TO api_keys;

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

DROP TABLE IF EXISTS user_preferences;
