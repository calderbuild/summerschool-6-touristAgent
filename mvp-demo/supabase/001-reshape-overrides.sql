-- One-off, 2026-07-28. The first `place_overrides` had three translated columns
-- per field, which was a guess about `Place` rather than a reading of it: those
-- fields are single strings in `lib/places.ts`. The table was minutes old and
-- empty, so this replaces it with the shape in `schema.sql` rather than carrying
-- six columns nothing will ever write.
--
-- Kept as a file rather than run ad hoc, because a schema change nobody can read
-- back later is how a database and its source drift apart.

drop table if exists public.place_overrides cascade;
