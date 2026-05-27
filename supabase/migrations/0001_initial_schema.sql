-- =========================================================================
-- WordCourt - initial schema, indexes, realtime publication, RLS policies
--
-- Run this once in the Supabase Dashboard SQL Editor for project
-- cjflxydqfdqikktubvvx.supabase.co (or via `supabase db push` if you wire the
-- CLI later). Idempotent helpers are used where reasonable; running this on a
-- non-empty database will error on the CREATE TABLE statements, which is the
-- safest behaviour for a destructive migration.
--
-- Architecture: Supabase is the realtime/app layer and caches GenLayer state.
-- GenLayer remains the source of truth for board, scores, moves, challenges,
-- and final settlement. Only the service role may write the cached official
-- gameplay state (games.official_state, board_cells, moves, etc.).
-- =========================================================================

set client_min_messages to warning;

-- -------------------------------------------------------------------------
-- 1. Shared trigger function: keep updated_at fresh on row updates.
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 2. Tables (PDF section 16).
-- -------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text,
  avatar_url text,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  total_score integer not null default 0,
  highest_word_score integer not null default 0,
  bingos_played integer not null default 0,
  challenges_won integer not null default 0,
  challenges_lost integer not null default 0,
  fair_play_score integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  creator_wallet text not null,
  max_players integer not null check (max_players in (2, 3, 4)),
  mode text not null check (mode in ('classic', 'blitz', 'crypto', 'naija', 'custom')),
  dictionary_mode text not null default 'classic'
    check (dictionary_mode in ('classic', 'crypto', 'genlayer', 'naija', 'custom')),
  status text not null
    check (status in ('waiting', 'dealing', 'active', 'completed', 'cancelled')),
  genlayer_game_id text,
  current_players integer not null default 1,
  is_private boolean not null default false,
  turn_seconds integer not null default 120,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  wallet_address text not null,
  seat_index integer not null,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, wallet_address),
  unique (room_id, seat_index)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  genlayer_game_id text unique not null,
  room_id uuid references public.rooms(id) on delete set null,
  status text not null
    check (status in ('waiting', 'dealing', 'active', 'challenge_pending', 'completed', 'cancelled')),
  dictionary_mode text not null default 'classic'
    check (dictionary_mode in ('classic', 'crypto', 'genlayer', 'naija', 'custom')),
  creator_wallet text not null,
  current_turn_wallet text,
  move_count integer not null default 0,
  pass_count integer not null default 0,
  tile_bag_remaining integer not null default 100,
  winner_wallet text,
  official_state jsonb,
  last_tx_hash text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  wallet_address text not null,
  seat_index integer not null,
  score integer not null default 0,
  rack_count integer not null default 7,
  final_rank integer,
  has_finished boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, wallet_address),
  unique (game_id, seat_index)
);

create table public.player_racks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  wallet_address text not null,
  tiles jsonb not null,
  rack_commitment text,
  rack_version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (game_id, wallet_address)
);

create table public.tile_bags (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade unique,
  remaining_tiles jsonb not null,
  used_tiles jsonb not null default '[]'::jsonb,
  exchanged_tiles jsonb not null default '[]'::jsonb,
  bag_commitment text not null,
  draw_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.board_cells (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  row integer not null check (row >= 0 and row <= 14),
  col integer not null check (col >= 0 and col <= 14),
  letter text not null,
  tile_id text,
  owner_wallet text not null,
  points integer not null,
  is_blank boolean not null default false,
  blank_letter text,
  turn_placed integer not null,
  created_at timestamptz not null default now(),
  unique (game_id, row, col)
);

create table public.moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  genlayer_game_id text not null,
  move_number integer not null,
  player_wallet text not null,
  move_type text not null
    check (move_type in ('play_word', 'pass', 'exchange', 'challenge', 'forfeit', 'end_game')),
  placements jsonb,
  formed_words jsonb,
  score_delta integer not null default 0,
  claimed_score integer,
  official_score integer,
  challenge_status text,
  tx_hash text,
  proof jsonb,
  created_at timestamptz not null default now(),
  unique (genlayer_game_id, move_number)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  move_id uuid references public.moves(id) on delete cascade,
  genlayer_game_id text not null,
  raised_by_wallet text not null,
  challenged_player_wallet text not null,
  reason text not null,
  status text not null check (status in ('open', 'resolved', 'rejected')),
  ruling text,
  genlayer_ruling jsonb,
  tx_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  wallet_address text not null,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.leaderboard (
  wallet_address text primary key,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  total_score integer not null default 0,
  average_score numeric not null default 0,
  highest_word_score integer not null default 0,
  bingos_played integer not null default 0,
  challenges_won integer not null default 0,
  challenges_lost integer not null default 0,
  fair_play_score integer not null default 100,
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  genlayer_game_id text,
  action text not null,
  tx_hash text,
  status text not null check (status in ('pending', 'confirmed', 'failed')),
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Server-side SIWE nonces. One row per pending wallet sign-in.
-- Phase 3b consumes these. Created here so the schema is complete.
create table public.siwe_nonces (
  wallet_address text not null,
  nonce text primary key,
  domain text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 3. Indexes (performance + lookup patterns the app actually uses).
-- -------------------------------------------------------------------------
create index profiles_created_at_idx       on public.profiles (created_at desc);
create index rooms_status_created_idx      on public.rooms (status, created_at desc);
create index rooms_creator_wallet_idx      on public.rooms (creator_wallet);
create index room_players_wallet_idx       on public.room_players (wallet_address);
create index room_players_room_idx         on public.room_players (room_id);
create index games_status_idx              on public.games (status);
create index games_creator_wallet_idx      on public.games (creator_wallet);
create index games_current_turn_idx        on public.games (current_turn_wallet);
create index game_players_wallet_idx       on public.game_players (wallet_address);
create index game_players_game_idx         on public.game_players (game_id);
create index moves_game_idx                on public.moves (game_id, move_number);
create index moves_player_idx              on public.moves (player_wallet, created_at desc);
create index challenges_game_idx           on public.challenges (game_id, created_at desc);
create index challenges_status_idx         on public.challenges (status);
create index chat_messages_room_idx        on public.chat_messages (room_id, created_at desc);
create index chat_messages_game_idx        on public.chat_messages (game_id, created_at desc);
create index leaderboard_total_score_idx   on public.leaderboard (total_score desc);
create index transactions_wallet_idx       on public.transactions (wallet_address, created_at desc);
create index transactions_status_idx       on public.transactions (status);
create index siwe_nonces_wallet_idx        on public.siwe_nonces (wallet_address);
create index siwe_nonces_expires_idx       on public.siwe_nonces (expires_at);

-- -------------------------------------------------------------------------
-- 4. updated_at triggers for every table that has the column.
-- -------------------------------------------------------------------------
create trigger profiles_set_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at         before update on public.rooms         for each row execute function public.set_updated_at();
create trigger games_set_updated_at         before update on public.games         for each row execute function public.set_updated_at();
create trigger game_players_set_updated_at  before update on public.game_players  for each row execute function public.set_updated_at();
create trigger player_racks_set_updated_at  before update on public.player_racks  for each row execute function public.set_updated_at();
create trigger tile_bags_set_updated_at     before update on public.tile_bags     for each row execute function public.set_updated_at();
create trigger leaderboard_set_updated_at   before update on public.leaderboard   for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at  before update on public.transactions  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- 5. Realtime publication (PDF section 17).
--    Publish only the tables that drive realtime UX. NEVER publish
--    tile_bags or player_racks - they are private to the owning player.
-- -------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  foreach t in array array[
    'rooms', 'room_players', 'games', 'game_players',
    'board_cells', 'moves', 'challenges', 'chat_messages'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- 6. Row Level Security (PDF section 18).
--
--    Convention: every wallet_address column stores LOWER-CASE addresses.
--    The SIWE flow mints a Supabase-compatible JWT with claim
--      "wallet_address": "<lower-case wallet>"
--    so policies can match auth.jwt() ->> 'wallet_address' directly.
--    The service_role bypasses RLS automatically; we therefore only write
--    policies for anon / authenticated.
-- -------------------------------------------------------------------------

-- Helper: current authenticated wallet (lower-cased, NULL if unauthenticated).
create or replace function public.current_wallet()
returns text
language sql
stable
as $$
  select lower(nullif(auth.jwt() ->> 'wallet_address', ''));
$$;

alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.room_players   enable row level security;
alter table public.games          enable row level security;
alter table public.game_players   enable row level security;
alter table public.player_racks   enable row level security;
alter table public.tile_bags      enable row level security;
alter table public.board_cells    enable row level security;
alter table public.moves          enable row level security;
alter table public.challenges     enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.leaderboard    enable row level security;
alter table public.transactions   enable row level security;
alter table public.siwe_nonces    enable row level security;

-- ---- profiles ----------------------------------------------------------
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Wallet owner can upsert own profile"
  on public.profiles for insert
  to authenticated
  with check (lower(wallet_address) = public.current_wallet());

create policy "Wallet owner can update own profile"
  on public.profiles for update
  to authenticated
  using (lower(wallet_address) = public.current_wallet())
  with check (lower(wallet_address) = public.current_wallet());

-- ---- rooms -------------------------------------------------------------
create policy "Public rooms are readable; private rooms only to participants"
  on public.rooms for select
  to anon, authenticated
  using (
    is_private = false
    or exists (
      select 1 from public.room_players rp
      where rp.room_id = rooms.id
        and lower(rp.wallet_address) = public.current_wallet()
    )
    or lower(creator_wallet) = public.current_wallet()
  );

create policy "Authenticated wallet can create rooms it owns"
  on public.rooms for insert
  to authenticated
  with check (lower(creator_wallet) = public.current_wallet());

create policy "Creator can update or cancel own room"
  on public.rooms for update
  to authenticated
  using (lower(creator_wallet) = public.current_wallet())
  with check (lower(creator_wallet) = public.current_wallet());

-- ---- room_players ------------------------------------------------------
create policy "Room rosters are readable"
  on public.room_players for select
  to anon, authenticated
  using (true);

create policy "Wallet can join as itself"
  on public.room_players for insert
  to authenticated
  with check (lower(wallet_address) = public.current_wallet());

create policy "Wallet can update its own ready state"
  on public.room_players for update
  to authenticated
  using (lower(wallet_address) = public.current_wallet())
  with check (lower(wallet_address) = public.current_wallet());

create policy "Wallet can leave own seat"
  on public.room_players for delete
  to authenticated
  using (lower(wallet_address) = public.current_wallet());

-- ---- games / game_players / board_cells / moves ------------------------
-- Cached official state is publicly readable; writes happen only via the
-- service-role sync worker (which bypasses RLS).
create policy "Game cache is readable"          on public.games          for select to anon, authenticated using (true);
create policy "Game players are readable"       on public.game_players   for select to anon, authenticated using (true);
create policy "Board cells are readable"        on public.board_cells    for select to anon, authenticated using (true);
create policy "Moves are readable"              on public.moves          for select to anon, authenticated using (true);

-- ---- challenges --------------------------------------------------------
create policy "Challenges are readable"
  on public.challenges for select
  to anon, authenticated
  using (true);

create policy "Wallet can raise challenges as itself"
  on public.challenges for insert
  to authenticated
  with check (lower(raised_by_wallet) = public.current_wallet());

-- ---- player_racks (PRIVATE) -------------------------------------------
-- No anon access. Authenticated wallet can read only its own rack.
-- All writes must come from the service role (tile bag service / sync).
create policy "Wallet can read only its own rack"
  on public.player_racks for select
  to authenticated
  using (lower(wallet_address) = public.current_wallet());

-- ---- tile_bags (PRIVATE) ----------------------------------------------
-- Service role only. No client-side policies needed; without any policy,
-- anon/authenticated have no access by default with RLS enabled.

-- ---- chat_messages ----------------------------------------------------
create policy "Chat readable by room participants"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = chat_messages.room_id
        and lower(rp.wallet_address) = public.current_wallet()
    )
  );

create policy "Chat sendable as own wallet by room participants"
  on public.chat_messages for insert
  to authenticated
  with check (
    lower(wallet_address) = public.current_wallet()
    and exists (
      select 1 from public.room_players rp
      where rp.room_id = chat_messages.room_id
        and lower(rp.wallet_address) = public.current_wallet()
    )
  );

-- ---- leaderboard ------------------------------------------------------
create policy "Leaderboard is publicly readable"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

-- ---- transactions -----------------------------------------------------
create policy "Wallet can read its own transactions"
  on public.transactions for select
  to authenticated
  using (lower(wallet_address) = public.current_wallet());

-- ---- siwe_nonces -----------------------------------------------------
-- Server-only table; no client policies. Anon/authenticated have no access.

-- =========================================================================
-- Done. Verify with:
--   select tablename from pg_tables where schemaname = 'public' order by 1;
-- Expected: 14 tables (profiles, rooms, room_players, games, game_players,
-- player_racks, tile_bags, board_cells, moves, challenges, chat_messages,
-- leaderboard, transactions, siwe_nonces).
-- =========================================================================
