# M4 SOS during a booking

## Goal
M4 SOS during a booking

## User flow
On a booked / in-progress job, either party taps SOS → confirm → event with GPS saved → Team desk shows it live with phone numbers and map → acknowledge → resolve.

## Database (see supabase/schema.sql)
sos_events: job_id, raised_by, latitude, longitude, accuracy_m, contact_name, contact_phone, status, resolved_at

## Status
Built and covered by tests.
