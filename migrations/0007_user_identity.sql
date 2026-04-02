-- Per-user identity scoping for settings, API keys, and link authorship.

-- 1. Recreate settings with (identity, key) composite primary key.
--    D1 does not support ALTER TABLE ADD COLUMN on a table whose PK needs changing,
--    so we recreate the table and migrate the existing global row to 'anonymous'.
CREATE TABLE settings_new (
  identity TEXT NOT NULL,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (identity, key)
);

INSERT INTO settings_new (identity, key, value)
  SELECT 'anonymous', key, value FROM settings;

DROP TABLE settings;

ALTER TABLE settings_new RENAME TO settings;

-- 2. Add identity column to api_keys. Existing keys become anonymous-owned.
ALTER TABLE api_keys ADD COLUMN identity TEXT NOT NULL DEFAULT 'anonymous';

CREATE INDEX IF NOT EXISTS idx_api_keys_identity ON api_keys(identity);

-- 3. Add created_by column to links. Records who created each link.
ALTER TABLE links ADD COLUMN created_by TEXT DEFAULT 'anonymous';
