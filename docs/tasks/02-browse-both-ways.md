# M3 browse and choose, both ways

## Goal
M3 browse and choose, both ways

## User flow
Families browse /helpers (filters, verified first) and press Hire. Helpers browse /jobs and make an offer. Self is excluded from both lists.

## Database (see supabase/schema.sql)
profiles (offers_help, chores, verification_status), jobs (status = open, invited_helper_id is null, poster_id)

## Status
Built and covered by tests.
