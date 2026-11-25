# M1 one-minute price negotiation

## Goal
M1 one-minute price negotiation

## User flow
Helper offers on a job, or hirer hires a browsed helper. The other side accepts / counters / declines within 60 s. Accept books the job and closes other offers. Lapsed sessions can be retried. Live banner on every page.

## Database (see supabase/schema.sql)
negotiations: job_id, hirer_id, helper_id, started_by, current_price, last_offer_by, offer_count, history, status, expires_at; trigger negotiations_enforce_timer

## Status
Built and covered by tests.
