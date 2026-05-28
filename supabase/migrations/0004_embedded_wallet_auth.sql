-- -------------------------------------------------------------------------
-- Embedded wallet auth: email/password profiles with an encrypted, client-
-- generated wallet. The private key is generated and encrypted in the browser;
-- only the AES-GCM ciphertext blob is stored here. The server never sees the
-- plaintext key. `display_name` is shown alongside the wallet address in-game
-- and across history/leaderboard.
-- -------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists encrypted_wallet jsonb,
  add column if not exists display_name text;

-- Email must be unique when present (case-insensitive).
create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;
