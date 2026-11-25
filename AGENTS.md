# AGENTS.md — Sahaj

Sahaj is a Pokhara web portal where families hire household help and gig helpers
(including verified students) find paid work. Read `docs/PRD.md` first.

## Map
- `supabase/schema.sql` — database source of truth (profiles, jobs, negotiations, sos_events)
- `src/lib/types.ts` — row types; must match the schema
- `src/lib/negotiation.ts`, `validation.ts`, `format.ts` — pure business logic (unit-tested)
- `src/lib/data.ts` — every Supabase query
- `src/app/actions.ts` — server actions (the only place that writes)
- `src/app/**/page.tsx` — pages; `src/components/` — UI
- `scripts/local-supabase/` — offline Postgres + REST stand-in for tests (not used in production)

## MVP Guardrails
- **No Auth:** Do not implement login, signup, or Supabase Auth. Treat the app as a single-user demo. The "acting as" person picker is a demo switcher stored in a cookie, not auth.
- **One person, both sides:** a profile can post jobs and (with `offers_help`) take jobs. Never add an exclusive role column.
- **Database:** Always read `supabase/schema.sql` before writing any Supabase query or TypeScript type. Never guess table or column names. If a feature needs a new column or table, update `supabase/schema.sql` first (with `add column if not exists`) and tell the user to run the SQL in Supabase.
- **Price rules** live in `src/lib/constants.ts` and the CHECK constraints in the schema. Change both together.
- **Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, `@supabase/supabase-js`.
- **Testing:** Use Vitest (`npm test`). Do NOT install Playwright or Cypress. Write unit tests for pure business logic first (TDD). `npm run test:e2e` checks schema rules against the configured Supabase.
- **Scope:** Keep solutions simple, clean, and demo-ready. Avoid over-engineering.

## UI Guidelines
- **Components:** Use shadcn/ui first (`npx shadcn@latest add <component>`). Don't hand-build buttons, inputs, dialogs, etc. Use `lucide-react` for icons.
- **Styling:** Tailwind utility classes only. Use theme tokens (`bg-background`, `text-muted-foreground`), not hardcoded colors, and `cn()` for conditional classes.
- **Layout:** Mobile-first and responsive. Every demo screen must work on a phone.
- **States:** Every data-driven view must handle loading, empty, and error states. Use toasts (`sonner`) for action feedback.
- **Components architecture:** Server Components by default. Add `"use client"` only when you need state, effects, or event handlers.
- **Accessibility:** Semantic HTML, labels on all inputs, alt text on images.
- **Privacy:** never send ID numbers or trusted-contact details to other users — use `toPublic()`.
