-- ---------------------------------------------------------------------
-- One-off repair for a Supabase project whose negotiations table was
-- created by an older design. Run AFTER schema.sql. Idempotent.
--
-- Symptoms it fixes:
--   null value in column "proposed_by" of relation "negotiations" violates not-null constraint
--   new row for relation "negotiations" violates check constraint ... (status 'active')
-- ---------------------------------------------------------------------

-- 1) Legacy column the app never writes.
alter table public.negotiations drop column if exists proposed_by;

do $$
declare
  r record;
begin
  -- 2) Any other required column without a default (e.g. legacy "price") blocks inserts:
  --    make it optional. Columns the app uses already have defaults or are nullable.
  for r in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'negotiations'
      and is_nullable = 'NO'
      and column_default is null
      and column_name <> 'id'
  loop
    execute format('alter table public.negotiations alter column %I drop not null', r.column_name);
  end loop;

  -- 3) Drop every CHECK constraint that mentions status (old value lists).
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.negotiations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.negotiations drop constraint %I', r.conname);
  end loop;
end $$;

-- 4) Re-add the current status rule. NOT VALID = enforced for new and updated rows,
--    without failing on (or rewriting) any old rows that still carry legacy values.
alter table public.negotiations
  add constraint negotiations_status_check
  check (status in ('active', 'accepted', 'declined', 'expired')) not valid;

alter table public.negotiations alter column status set default 'active';
