# M5 one-time or recurring, multi-chore booking

## Goal
M5 one-time or recurring, multi-chore booking

## User flow
Post a job (/jobs/new) with 1+ chores, one-time / daily / weekly + days, date, time, area, budget. Booking lifecycle open → booked → in_progress → completed / cancelled.

## Database (see supabase/schema.sql)
jobs: chores, frequency, recurring_days, start_date, start_time, area, address, budget, agreed_price, status, helper_id

## Status
Built and covered by tests.
