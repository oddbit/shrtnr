-- Bundles: user-owned collections of links.
-- A link can belong to zero or many bundles. Stats on a bundle are combined
-- across all its links. Ownership follows the same per-identity model as links.

CREATE TABLE bundles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  accent      TEXT NOT NULL DEFAULT 'orange' CHECK (accent IN ('orange','red','green','blue','purple')),
  archived_at INTEGER,
  created_via TEXT DEFAULT 'app',
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_bundles_created_by ON bundles(created_by);
CREATE INDEX idx_bundles_archived_at ON bundles(archived_at);

CREATE TABLE bundle_links (
  bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  link_id   INTEGER NOT NULL REFERENCES links(id)   ON DELETE CASCADE,
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (bundle_id, link_id)
);

CREATE INDEX idx_bundle_links_link_id ON bundle_links(link_id);

-- Silent visitor fingerprint. Start recording a daily-rotated hash of
-- IP + User-Agent + daily salt so unique-visitor analytics become possible
-- from this point forward. No UI surface yet; populated best-effort.
-- Privacy model: SHA-256(ip + ua + HMAC(server_secret, date)), salt rotates
-- every 24h so fingerprints cannot be correlated across days.
ALTER TABLE clicks ADD COLUMN visitor_fp TEXT;
CREATE INDEX idx_clicks_visitor_fp ON clicks(visitor_fp);
