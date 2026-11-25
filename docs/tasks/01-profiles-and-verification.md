# Profiles (one person, both sides) + M2 verification

## Goal
Profiles (one person, both sides) + M2 verification

## User flow
Create a profile, optionally turn on “I also offer help”, then submit a student ID (students) or government ID (adults). Team approves on /desk.

## Database (see supabase/schema.sql)
profiles: full_name, phone, area, offers_help, chores, min_price, is_student, verification_*, trusted_contact_*

## Status
Built and covered by tests.
