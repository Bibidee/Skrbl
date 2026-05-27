-- =========================================================================
-- WordCourt - migration 0003 - explicit grants for Supabase roles
--
-- Symptom this fixes:
--   GET /api/rooms -> 500 "permission denied for table rooms"
-- even though the service_role JWT is correct.
--
-- Cause: when tables are created via the Dashboard SQL Editor in raw SQL
-- (rather than via the Table Editor UI), Supabase's automatic
-- table-creation grant hook can be skipped for some projects, leaving
-- service_role / authenticated / anon without table-level GRANTs even
-- though service_role has BYPASSRLS at the role level.
--
-- This migration re-applies the standard Supabase grant matrix and sets
-- default privileges so future tables inherit them too. Idempotent.
-- =========================================================================

set client_min_messages to warning;

-- ---- service_role: full power ------------------------------------------
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- ---- authenticated: read/write subject to RLS --------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---- anon: read-only subject to RLS ------------------------------------
grant usage on schema public to anon;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant execute on all functions in schema public to anon;

-- ---- Default privileges for *future* tables created by postgres user ---
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to anon;
alter default privileges in schema public
  grant execute on functions to anon;

-- =========================================================================
-- Verify with the same query that returned 500:
--   select * from public.rooms limit 0;
-- This should now run cleanly under the service_role.
-- =========================================================================
