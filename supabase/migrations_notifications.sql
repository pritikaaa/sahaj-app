-- ---------------------------------------------------------------------
-- notifications: in-app bell items for negotiation events.
-- Idempotent: safe to run more than once. Also included in schema.sql.
-- Text holds names, job title and price only (never phones, IDs or
-- trusted contacts).
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  negotiation_id uuid references public.negotiations(id) on delete cascade,
  kind text not null check (kind in ('offer_received','offer_sent','countered','accepted','declined','lapsed')),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_profile_idx
  on public.notifications (profile_id, read_at, created_at desc);
-- a lapsed session is announced once per person (the app checks first; this backs it up)
create unique index if not exists notifications_lapsed_once_idx
  on public.notifications (profile_id, negotiation_id) where kind = 'lapsed';

grant select, insert, update, delete on public.notifications to anon;
alter table public.notifications enable row level security;
drop policy if exists "anon full access" on public.notifications;
create policy "anon full access" on public.notifications
  for all to anon using (true) with check (true);
