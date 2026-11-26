-- ---------------------------------------------------------------------
-- Two-way counters: up to 10 offers per one-minute negotiation
-- (opening offer + up to 9 counters, from either side).
-- Idempotent. Must match MAX_OFFERS in src/lib/constants.ts.
-- The negotiations_enforce_timer trigger is unchanged.
-- ---------------------------------------------------------------------
alter table public.negotiations drop constraint if exists negotiations_offer_count_check;
alter table public.negotiations add constraint negotiations_offer_count_check check (offer_count >= 1 and offer_count <= 10);
