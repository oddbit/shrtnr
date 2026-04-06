-- Consolidated schema for shrtnr

CREATE TABLE links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT NOT NULL,
  label       TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER,
  created_via TEXT DEFAULT 'app',
  created_by  TEXT DEFAULT 'anonymous'
);

CREATE TABLE slugs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id          INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE,
  is_custom        INTEGER NOT NULL DEFAULT 0,
  is_primary       INTEGER NOT NULL DEFAULT 0,
  link_click_count INTEGER NOT NULL DEFAULT 0,
  qr_click_count   INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  disabled_at      INTEGER
);

CREATE INDEX idx_slugs_slug ON slugs(slug);
CREATE INDEX idx_slugs_link_id ON slugs(link_id);

CREATE TABLE clicks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug_id       INTEGER NOT NULL REFERENCES slugs(id) ON DELETE CASCADE,
  clicked_at    INTEGER NOT NULL,

  referrer      TEXT,
  referrer_host TEXT,

  country       TEXT,
  region        TEXT,
  city          TEXT,

  device_type   TEXT,
  os            TEXT,
  browser       TEXT,
  language      TEXT,

  link_mode     TEXT DEFAULT 'link',
  channel       TEXT,

  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,

  user_agent    TEXT,
  is_bot        INTEGER DEFAULT 0
);

CREATE INDEX idx_clicks_slug_id ON clicks(slug_id);
CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
CREATE INDEX idx_clicks_country ON clicks(country);
CREATE INDEX idx_clicks_link_mode ON clicks(link_mode);
CREATE INDEX idx_clicks_referrer_host ON clicks(referrer_host);
CREATE INDEX idx_clicks_os ON clicks(os);

CREATE TABLE settings (
  identity TEXT NOT NULL,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (identity, key)
);

INSERT INTO settings (identity, key, value) VALUES ('anonymous', 'slug_default_length', '3');

CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scope        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  identity     TEXT NOT NULL DEFAULT 'anonymous'
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_identity ON api_keys(identity);
