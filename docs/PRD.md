# Product Requirements Document (PRD): Sahaj — v0.2

Source: team PRD v0.1 (shared doc, 24 Nov 2026) + build decisions. Team Powerpuff, CODE Bootcamp.

## 1. Overview
**Sahaj** is a Pokhara web portal where families hire household help and gig helpers — including
verified students — find paid work. Both sides browse and choose, and agree a price in one minute.
Existing alternative: **Maid Shree** (dispatches the nearest helper, fixed pay floor, no negotiation).

## 2. Users & scope
- **Family hirer** — needs trustworthy, regular or occasional household help.
- **Gig helper** — anyone who wants household gigs, including students in free time.
- **The same person can be both.** One profile posts jobs and, with “I also offer help”, takes jobs.
- **Sahaj team** — answers SOS alerts and reviews IDs on the Team desk.
- **No authentication** (MVP rule). A demo “acting as” picker switches people on one device.
- **Tech stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, **Supabase (PostgreSQL)**.
  (v0.1 listed MERN; replaced by Supabase per the Day 3 build guide.)

## 3. Must features (MVP)
| # | Feature | MVP behaviour |
|---|---|---|
| M1 | 1-minute price negotiation | Either side opens with a price. Both sides can go back and forth within the one-minute window, up to 10 offers in total; the receiver of an offer can Accept or Counter (or decline). You can't accept your own offer, but you may change it by countering again. An accept or counter made against a price that just changed is refused. Session lapses 60 s after it starts (counters don't extend it). Enforced by the server and a DB trigger. Price is **NPR per visit**, floor **NPR 300**, ceiling NPR 50,000. Lapsed sessions can be retried. |
| M2 | Gig access + verification | Anyone can offer help. Students verify with a **student ID**, adults with a **government ID** (citizenship, licence, passport). Status: unverified → pending → verified / rejected. Team reviews manually on the desk. ID numbers are visible only to the team. |
| M3 | Browse and choose, both ways | Families browse helpers (filter by chore, verified, students; verified first) and hire one. Helpers browse open jobs (filter by chore) and make an offer. Hirers choose among offers. |
| M4 | SOS | One-tap SOS (with confirm) during a booked / in-progress job. Records user, booking, time, GPS location. **Recipients:** SOS alerts the Sahaj team desk and dials the police (100). The trusted contact is stored on the event for the desk; there are no call / SMS buttons to the contact. |
| M5 | Booking: one-time or recurring, multiple chores | A job has 1+ chores and is one-time, daily or weekly (chosen days). Lifecycle: open → booked → in progress → completed (or cancelled). |

## 4. Decisions on v0.1 open TODOs (team to confirm)
- **Price unit / floor:** NPR per visit; floor NPR 300; ceiling NPR 50,000 (`src/lib/constants.ts` + schema CHECKs).
- **Counteroffers:** max 10 offers per session (opening + up to 9 counters, from either side).
- **Who may start:** the helper (offer on an open job) or the hirer (hire a browsed helper).
- **SOS recipient:** SOS alerts the Sahaj team desk and dials the police (100). The trusted contact stays on the profile and the event for the desk. No SMS gateway in MVP.
- **Non-student verification:** government ID number + issuing office, reviewed by the team.
- **ID images:** not stored in MVP (number + issuer only; team checks the card in person / video).

## 5. Out of scope
Payments, background/police checks, native app, in-app chat, AI features, auto-scheduling of
recurring jobs, notifications, ratings (Should, if time remains).

## 6. Acceptance criteria (each has a test)
- **M1:** a session older than one minute can't be accepted or countered (unit + DB trigger + browser). A price below NPR 300 is rejected.
- **M2:** a student who submits an ID shows “Verification pending”, then “Verified student” after review. Non-students can still offer help.
- **M3:** a family sees helper profiles and a helper sees job posts; each can select one. Nobody sees or hires themselves.
- **M4:** tapping SOS creates a recorded event with user, time and location, visible on the Team desk.
- **M5:** a booking can include more than one chore and be one-time or recurring.
- **Dual role:** one person can have a job they posted and a job they work at the same time.
