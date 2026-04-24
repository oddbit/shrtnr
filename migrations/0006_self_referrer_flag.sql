-- Flag clicks whose Referer was the bare origin of the serving host
-- (e.g. `https://<host>/` with no path, query, or fragment). These are
-- typically bot-forged or uninformative landing-page bounces. The flag
-- lets the Sources and Domains breakdowns hide them at query time while
-- keeping the raw click count intact. Filtering decisions live in the
-- query layer, not at ingest.
ALTER TABLE clicks ADD COLUMN is_self_referrer INTEGER DEFAULT 0;

CREATE INDEX idx_clicks_is_self_referrer ON clicks(is_self_referrer);
