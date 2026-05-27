-- =========================================================================
-- WordCourt - migration 0002 - align Supabase with the deployed v0.3.0 contract
--
-- The deployed contract uses (word_mode, theme) instead of dictionary_mode.
-- Modes:
--   classic + none
--   themed  + crypto | genlayer
--   custom  + none
--
-- This migration:
--   - Adds word_mode + theme columns to rooms and games.
--   - Adds matching CHECK constraints.
--   - Keeps the legacy dictionary_mode column for one cycle so previously
--     inserted rows don't break; new rows MUST provide word_mode + theme.
--
-- Paste into the Supabase Dashboard SQL Editor and Run.
-- =========================================================================

set client_min_messages to warning;

alter table public.rooms
  add column if not exists word_mode text not null default 'classic'
    check (word_mode in ('classic', 'themed', 'custom')),
  add column if not exists theme text not null default 'none'
    check (theme in ('none', 'crypto', 'genlayer'));

alter table public.games
  add column if not exists word_mode text not null default 'classic'
    check (word_mode in ('classic', 'themed', 'custom')),
  add column if not exists theme text not null default 'none'
    check (theme in ('none', 'crypto', 'genlayer'));

-- Cross-column consistency: themed requires a real theme; classic/custom must
-- be theme='none'. Enforced via trigger because CHECK constraints can't refer
-- to other columns portably across pg versions.

create or replace function public.enforce_mode_theme_consistency()
returns trigger
language plpgsql
as $$
begin
  if new.word_mode = 'themed' and new.theme = 'none' then
    raise exception 'THEMED_MODE_REQUIRES_THEME';
  end if;
  if new.word_mode <> 'themed' and new.theme <> 'none' then
    raise exception 'THEME_ONLY_ALLOWED_FOR_THEMED_MODE';
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_mode_theme_consistency on public.rooms;
create trigger rooms_mode_theme_consistency
  before insert or update on public.rooms
  for each row execute function public.enforce_mode_theme_consistency();

drop trigger if exists games_mode_theme_consistency on public.games;
create trigger games_mode_theme_consistency
  before insert or update on public.games
  for each row execute function public.enforce_mode_theme_consistency();

-- The legacy dictionary_mode column stays for now but its CHECK is loosened to
-- include 'themed' so back-fills don't fail. Frontend / API code reads from
-- (word_mode, theme) going forward and ignores dictionary_mode.

alter table public.rooms drop constraint if exists rooms_dictionary_mode_check;
alter table public.games drop constraint if exists games_dictionary_mode_check;

alter table public.rooms
  add constraint rooms_dictionary_mode_check
  check (dictionary_mode in ('classic', 'crypto', 'genlayer', 'naija', 'custom', 'themed'));

alter table public.games
  add constraint games_dictionary_mode_check
  check (dictionary_mode in ('classic', 'crypto', 'genlayer', 'naija', 'custom', 'themed'));

-- =========================================================================
-- Verify with:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'rooms' and column_name in ('word_mode','theme');
-- Expected: two rows.
-- =========================================================================
