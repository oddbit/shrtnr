-- Rename channel → link_mode so existing qr/direct values migrate in place
ALTER TABLE clicks RENAME COLUMN channel TO link_mode;

-- Fix link_mode values: 'direct' was the old default but link_mode means
-- how the link was consumed (link vs qr), not traffic source
UPDATE clicks SET link_mode = 'link' WHERE link_mode = 'direct';

-- Traffic/marketing source classification (separate from how the link was accessed)
ALTER TABLE clicks ADD COLUMN channel TEXT;

-- Referrer domain extracted for aggregation
ALTER TABLE clicks ADD COLUMN referrer_host TEXT;

-- Operating system parsed from User-Agent
ALTER TABLE clicks ADD COLUMN os TEXT;

-- UTM campaign attribution
ALTER TABLE clicks ADD COLUMN utm_source TEXT;
ALTER TABLE clicks ADD COLUMN utm_medium TEXT;
ALTER TABLE clicks ADD COLUMN utm_campaign TEXT;
ALTER TABLE clicks ADD COLUMN utm_term TEXT;
ALTER TABLE clicks ADD COLUMN utm_content TEXT;

-- Optional fields for future use
ALTER TABLE clicks ADD COLUMN region TEXT;
ALTER TABLE clicks ADD COLUMN city TEXT;
ALTER TABLE clicks ADD COLUMN language TEXT;
ALTER TABLE clicks ADD COLUMN user_agent TEXT;
ALTER TABLE clicks ADD COLUMN is_bot INTEGER DEFAULT 0;

-- Indexes for common aggregation columns
CREATE INDEX idx_clicks_link_mode ON clicks(link_mode);
CREATE INDEX idx_clicks_referrer_host ON clicks(referrer_host);
CREATE INDEX idx_clicks_os ON clicks(os);
