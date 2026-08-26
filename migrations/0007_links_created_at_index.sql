-- The admin links listing windows in SQL: it filters, orders by
-- `created_at DESC, id DESC`, then applies LIMIT/OFFSET. With no index on
-- those columns SQLite scans links and builds a temp B-tree to sort the whole
-- table, so rendering 25 rows costs O(catalog log catalog) on every request
-- and the windowing saves only the JS-side assembly.
--
-- The index covers the order the listing asks for, so the planner walks it and
-- stops after `limit + offset` rows. `recent()` and the dashboard panels use
-- the same ordering and get the same walk.
CREATE INDEX idx_links_created_at ON links(created_at DESC, id DESC);
