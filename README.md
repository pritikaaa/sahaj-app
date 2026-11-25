# Sahaj

Household help in Pokhara. Families hire helpers, and helpers (including verified students) find paid gigs.
Both sides browse and choose, then agree a price in one minute. One profile can do both.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · Vitest

## Run it (with your Supabase project)

1. In Supabase → **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   It is safe to re-run and safe on your existing `profiles / jobs / negotiations / sos_events` tables (it only adds missing columns).
2. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **anon public** key (Project Settings → API).
3. Install and start:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. Create two or three people with the **person picker** (top right) to demo both sides.

## Checks

```bash
npm test            # 29 unit tests: negotiation rules, validation, formatting, privacy
```

```bash
npm run test:e2e    # 6 database tests through supabase-js + anon key (creates and deletes its own rows)
```

```bash
npm run build
```

## Offline / local database (optional)

No internet or no Supabase project yet? Use a local Postgres plus a small REST stand-in that speaks the
same API as Supabase. This is for development only.

```bash
PGPASSWORD=postgres RESET=1 npm run db:local
```

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sahaj_local ANON_KEY=local-anon-key npm run supabase:local
```

Then set `.env.local` to `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key`.

## Demo script (3 minutes)

1. **Sita** (family) creates a profile. **Asha** creates one with “I also offer help” + “I am a student” and submits her student ID.
2. **Team desk** → Approve. Asha now shows “Verified student”.
3. Sita → **Hire help** → Hire Asha → Cleaning + Cooking, weekly Mon/Thu, NPR 600 → the one-minute clock starts.
4. Asha sees the live banner → counters NPR 800 → Sita accepts. The job is now booked.
5. Asha opens the booking → Start job → **SOS** → the Team desk shows it with a map and the trusted contact.
6. Asha → **Post a job** (laundry). **Ram** finds it in Find work and offers; Asha accepts. Asha is now hiring *and* working.

## Product rules

Defined in `src/lib/constants.ts`, mirrored by CHECK constraints in the schema:
price is NPR **per visit**, floor **300**, ceiling 50,000, max **6** offers, session **60 s**.
