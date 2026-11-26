-- =====================================================================
-- Sahaj — Supabase (PostgreSQL) schema. SOURCE OF TRUTH.
-- Paste the whole file into Supabase → SQL Editor → Run.
--
-- Safe to re-run, and safe on a project that already has these four
-- tables: every column is added with "add column if not exists", so
-- existing data is kept. If one of your existing columns has the same
-- name but a different type, Postgres keeps yours — compare and fix.
--
-- No auth (MVP rule): the app uses the anon key, so the anon role gets
-- full access through the policies at the bottom.
-- Money is whole Nepali rupees (NPR) per visit.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- profiles: one row per person. The SAME person can hire (post jobs)
-- AND work (offers_help = true). There is no separate "role" column.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);
alter table public.profiles
  add column if not exists full_name text not null default '',
  add column if not exists phone text,
  add column if not exists area text,
  add column if not exists bio text,
  add column if not exists offers_help boolean not null default false,
  add column if not exists chores text[] not null default '{}',
  add column if not exists min_price integer,
  add column if not exists is_student boolean not null default false,
  -- M2 verification: students → student_id, adults → government_id
  add column if not exists verification_type text
    check (verification_type in ('student_id', 'government_id')),
  add column if not exists verification_number text,
  add column if not exists verification_issuer text,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists verification_submitted_at timestamptz,
  -- M4 SOS: who gets alerted besides the team safety desk
  add column if not exists trusted_contact_name text,
  add column if not exists trusted_contact_phone text;

-- ---------------------------------------------------------------------
-- jobs: a job post AND, once a price is agreed, the booking (M3, M5).
--   open → booked → in_progress → completed   (or cancelled)
-- invited_helper_id is set when a family hires a helper they browsed.
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);
alter table public.jobs
  add column if not exists poster_id uuid references public.profiles(id) on delete cascade,
  add column if not exists invited_helper_id uuid references public.profiles(id) on delete set null,
  add column if not exists helper_id uuid references public.profiles(id) on delete set null,
  add column if not exists title text not null default '',
  add column if not exists chores text[] not null default '{}'
    check (cardinality(chores) >= 1),
  add column if not exists frequency text not null default 'one_time'
    check (frequency in ('one_time', 'daily', 'weekly')),
  add column if not exists recurring_days text[] not null default '{}',
  add column if not exists start_date date,
  add column if not exists start_time time,
  add column if not exists area text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists budget integer check (budget between 300 and 50000),
  add column if not exists agreed_price integer check (agreed_price between 300 and 50000),
  add column if not exists status text not null default 'open'
    check (status in ('open', 'booked', 'in_progress', 'completed', 'cancelled')),
  add column if not exists booked_at timestamptz;

create index if not exists jobs_status_idx on public.jobs (status, created_at desc);
create index if not exists jobs_poster_idx on public.jobs (poster_id);
create index if not exists jobs_helper_idx on public.jobs (helper_id);

-- ---------------------------------------------------------------------
-- negotiations: one-minute price sessions (M1).
-- Price per visit, NPR 300 floor, NPR 50,000 ceiling, max 6 offers.
-- ---------------------------------------------------------------------
create table if not exists public.negotiations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);
alter table public.negotiations
  add column if not exists job_id uuid references public.jobs(id) on delete cascade,
  add column if not exists hirer_id uuid references public.profiles(id) on delete cascade,
  add column if not exists helper_id uuid references public.profiles(id) on delete cascade,
  add column if not exists started_by uuid references public.profiles(id) on delete cascade,
  add column if not exists current_price integer
    check (current_price between 300 and 50000),
  add column if not exists last_offer_by uuid references public.profiles(id) on delete cascade,
  add column if not exists offer_count integer not null default 1,
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'accepted', 'declined', 'expired')),
  add column if not exists expires_at timestamptz,
  add column if not exists closed_at timestamptz;

-- Up to 10 offers per session (opening + up to 9 counters, either side).
-- Must match MAX_OFFERS in src/lib/constants.ts. Same as two_way_counters.sql.
alter table public.negotiations drop constraint if exists negotiations_offer_count_check;
alter table public.negotiations add constraint negotiations_offer_count_check check (offer_count >= 1 and offer_count <= 10);

-- one live session per job + helper at a time
create unique index if not exists negotiations_one_active_idx
  on public.negotiations (job_id, helper_id) where status = 'active';
create index if not exists negotiations_hirer_idx on public.negotiations (hirer_id, status);
create index if not exists negotiations_helper_idx on public.negotiations (helper_id, status);

-- The one-minute timer is enforced by the DATABASE clock, so no client
-- (even one calling the API directly with the anon key) can accept or
-- counter after the minute is up. Moving to 'expired' or 'declined'
-- is always allowed.
create or replace function public.negotiations_enforce_timer()
returns trigger language plpgsql as $$
begin
  if old.status <> 'active' and new.status is distinct from old.status then
    raise exception 'negotiation is already %', old.status using errcode = 'P0001';
  end if;
  if old.status = 'active'
     and new.status in ('active', 'accepted')
     and now() > old.expires_at then
    raise exception 'negotiation expired' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists negotiations_enforce_timer on public.negotiations;
create trigger negotiations_enforce_timer
  before update on public.negotiations
  for each row execute function public.negotiations_enforce_timer();

-- ---------------------------------------------------------------------
-- sos_events: one-tap SOS during a booking (M4).
-- Recipients: the Sahaj team safety desk (/desk page) + the person's
-- trusted contact (phone stored on the event so the desk can call).
-- ---------------------------------------------------------------------
create table if not exists public.sos_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now()
);
alter table public.sos_events
  add column if not exists job_id uuid references public.jobs(id) on delete set null,
  add column if not exists raised_by uuid references public.profiles(id) on delete cascade,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accuracy_m double precision,
  add column if not exists message text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  add column if not exists resolved_at timestamptz;

create index if not exists sos_status_idx on public.sos_events (status, created_at desc);

-- ---------------------------------------------------------------------
-- anon access (no-auth MVP)
-- ---------------------------------------------------------------------
grant usage on schema public to anon;
grant select, insert, update, delete on public.profiles     to anon;
grant select, insert, update, delete on public.jobs         to anon;
grant select, insert, update, delete on public.negotiations to anon;
grant select, insert, update, delete on public.sos_events   to anon;

alter table public.profiles     enable row level security;
alter table public.jobs         enable row level security;
alter table public.negotiations enable row level security;
alter table public.sos_events   enable row level security;

drop policy if exists "anon full access" on public.profiles;
drop policy if exists "anon full access" on public.jobs;
drop policy if exists "anon full access" on public.negotiations;
drop policy if exists "anon full access" on public.sos_events;

create policy "anon full access" on public.profiles
  for all to anon using (true) with check (true);
create policy "anon full access" on public.jobs
  for all to anon using (true) with check (true);
create policy "anon full access" on public.negotiations
  for all to anon using (true) with check (true);
create policy "anon full access" on public.sos_events
  for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------
-- notifications: in-app bell items for negotiation events.
-- (Same as supabase/migrations_notifications.sql, for existing projects.)
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
