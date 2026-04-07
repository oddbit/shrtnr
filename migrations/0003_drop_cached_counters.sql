-- Remove cached click counter columns from slugs table.
-- Click counts are now computed from the clicks table via aggregation.
-- This eliminates dual-write complexity and counter drift risk.

ALTER TABLE slugs DROP COLUMN link_click_count;
ALTER TABLE slugs DROP COLUMN qr_click_count;
