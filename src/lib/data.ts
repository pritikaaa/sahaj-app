// All Supabase queries live here. Table and column names come from
// supabase/schema.sql — never guess them.
import "server-only";
import { db } from "./supabase";
import { effectiveStatus } from "./negotiation";
import type { Job, JobStatus, Negotiation, Notification, NotificationKind, Profile, SosEvent, SosStatus } from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- profiles ----------
export async function listProfiles(): Promise<Profile[]> {
  return check(await db().from("profiles").select("*").order("created_at", { ascending: true }));
}

export async function getProfile(id: string): Promise<Profile | null> {
  return check(await db().from("profiles").select("*").eq("id", id).maybeSingle());
}

export async function getProfilesById(ids: string[]): Promise<Map<string, Profile>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows: Profile[] = check(await db().from("profiles").select("*").in("id", unique));
  return new Map(rows.map((p) => [p.id, p]));
}

export async function insertProfile(row: Partial<Profile>): Promise<Profile> {
  return check(await db().from("profiles").insert(row).select("*").single());
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<Profile> {
  return check(await db().from("profiles").update(patch).eq("id", id).select("*").single());
}

export async function listHelpers(opts: {
  excludeId?: string | null;
  chore?: string | null;
  studentsOnly?: boolean;
}): Promise<Profile[]> {
  let q = db().from("profiles").select("*").eq("offers_help", true);
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  if (opts.studentsOnly) q = q.eq("is_student", true);
  const rows: Profile[] = check(await q.order("created_at", { ascending: false }));
  const chore = opts.chore;
  return chore ? rows.filter((p) => p.chores.includes(chore)) : rows;
}

export async function listPendingVerifications(): Promise<Profile[]> {
  return check(
    await db().from("profiles").select("*").eq("verification_status", "pending").order("verification_submitted_at", { ascending: true })
  );
}

// ---------- jobs ----------
export async function getJob(id: string): Promise<Job | null> {
  return check(await db().from("jobs").select("*").eq("id", id).maybeSingle());
}

export async function insertJob(row: Partial<Job>): Promise<Job> {
  return check(await db().from("jobs").insert(row).select("*").single());
}

/** Remove a job that was just created (used when its first negotiation could not be saved). */
export async function deleteJob(id: string): Promise<void> {
  check(await db().from("jobs").delete().eq("id", id).select("id"));
}

/** Update a job only if it is still in `expect` status. Returns null if it was not. */
export async function updateJobIf(id: string, expect: JobStatus[], patch: Partial<Job>): Promise<Job | null> {
  const rows: Job[] = check(await db().from("jobs").update(patch).eq("id", id).in("status", expect).select("*"));
  return rows[0] ?? null;
}

export async function listOpenJobs(opts: { excludePosterId?: string | null; chore?: string | null }): Promise<Job[]> {
  let q = db().from("jobs").select("*").eq("status", "open").is("invited_helper_id", null);
  if (opts.excludePosterId) q = q.neq("poster_id", opts.excludePosterId);
  const rows: Job[] = check(await q.order("created_at", { ascending: false }));
  const chore = opts.chore;
  return chore ? rows.filter((j) => j.chores.includes(chore)) : rows;
}

export async function jobsPostedBy(profileId: string): Promise<Job[]> {
  return check(await db().from("jobs").select("*").eq("poster_id", profileId).order("created_at", { ascending: false }));
}

export async function jobsWorkedBy(profileId: string): Promise<Job[]> {
  return check(await db().from("jobs").select("*").eq("helper_id", profileId).order("start_date", { ascending: true }));
}

export async function getJobsById(ids: string[]): Promise<Map<string, Job>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows: Job[] = check(await db().from("jobs").select("*").in("id", unique));
  return new Map(rows.map((j) => [j.id, j]));
}

// ---------- negotiations ----------
/** Lazily close sessions whose minute is up, so lists never show stale "active" rows. */
async function expireStale(rows: Negotiation[]): Promise<Negotiation[]> {
  const now = new Date();
  const stale = rows.filter((n) => n.status === "active" && effectiveStatus(n, now) === "expired");
  if (stale.length) {
    await db()
      .from("negotiations")
      .update({ status: "expired", closed_at: now.toISOString() })
      .in("id", stale.map((n) => n.id))
      .eq("status", "active");
  }
  const ids = new Set(stale.map((n) => n.id));
  return rows.map((n) => (ids.has(n.id) ? { ...n, status: "expired" as const, closed_at: now.toISOString() } : n));
}

export async function getNegotiation(id: string): Promise<Negotiation | null> {
  const row: Negotiation | null = check(await db().from("negotiations").select("*").eq("id", id).maybeSingle());
  return row ? (await expireStale([row]))[0] : null;
}

export async function insertNegotiation(row: Partial<Negotiation>): Promise<Negotiation> {
  return check(await db().from("negotiations").insert(row).select("*").single());
}

/**
 * Update only while still active (optimistic concurrency). With `expectedOfferCount`, also only
 * if no new offer landed since the caller read it. Returns null if someone got there first.
 */
export async function updateActiveNegotiation(
  id: string,
  patch: Partial<Negotiation>,
  expectedOfferCount?: number
): Promise<Negotiation | null> {
  let q = db().from("negotiations").update(patch).eq("id", id).eq("status", "active");
  if (expectedOfferCount !== undefined) q = q.eq("offer_count", expectedOfferCount);
  const rows: Negotiation[] = check(await q.select("*"));
  return rows[0] ?? null;
}

export async function declineOtherActive(jobId: string, keepId: string): Promise<void> {
  check(
    await db()
      .from("negotiations")
      .update({ status: "declined", closed_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("status", "active")
      .neq("id", keepId)
      .select("id")
  );
}

export async function negotiationsForJob(jobId: string): Promise<Negotiation[]> {
  const rows: Negotiation[] = check(
    await db().from("negotiations").select("*").eq("job_id", jobId).order("created_at", { ascending: false })
  );
  return expireStale(rows);
}

export async function activeNegotiationFor(jobId: string, helperId: string): Promise<Negotiation | null> {
  const rows: Negotiation[] = check(
    await db().from("negotiations").select("*").eq("job_id", jobId).eq("helper_id", helperId).eq("status", "active")
  );
  const fresh = (await expireStale(rows)).filter((n) => n.status === "active");
  return fresh[0] ?? null;
}

export async function negotiationsInvolving(profileId: string, onlyActive = false): Promise<Negotiation[]> {
  const base = () => {
    const q = db().from("negotiations").select("*");
    return onlyActive ? q.eq("status", "active") : q;
  };
  const [asHirer, asHelper] = await Promise.all([
    base().eq("hirer_id", profileId).order("created_at", { ascending: false }).limit(50),
    base().eq("helper_id", profileId).order("created_at", { ascending: false }).limit(50),
  ]);
  const rows = [...check<Negotiation[]>(asHirer), ...check<Negotiation[]>(asHelper)];
  const fresh = await expireStale(rows);
  return onlyActive ? fresh.filter((n) => n.status === "active") : fresh;
}

// ---------- SOS ----------
/** The person's most recent booked / in-progress job, as poster or helper. */
export async function activeBookingFor(profileId: string): Promise<Job | null> {
  const rows: Job[] = check(
    await db()
      .from("jobs")
      .select("*")
      .in("status", ["booked", "in_progress"])
      .or(`poster_id.eq.${profileId},helper_id.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(1)
  );
  return rows[0] ?? null;
}

export async function insertSos(row: Partial<SosEvent>): Promise<SosEvent> {
  return check(await db().from("sos_events").insert(row).select("*").single());
}

export async function listSos(statuses: SosStatus[]): Promise<SosEvent[]> {
  return check(await db().from("sos_events").select("*").in("status", statuses).order("created_at", { ascending: false }).limit(100));
}

export async function sosForJob(jobId: string): Promise<SosEvent[]> {
  return check(await db().from("sos_events").select("*").eq("job_id", jobId).order("created_at", { ascending: false }));
}

export async function updateSos(id: string, patch: Partial<SosEvent>): Promise<SosEvent> {
  return check(await db().from("sos_events").update(patch).eq("id", id).select("*").single());
}

// ---------- notifications ----------
export async function insertNotification(row: Partial<Notification>): Promise<void> {
  check(await db().from("notifications").insert(row).select("id"));
}

export async function listNotifications(profileId: string, limit = 20): Promise<Notification[]> {
  return check(
    await db().from("notifications").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(limit)
  );
}

export async function unreadNotificationCount(profileId: string): Promise<number> {
  const res = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("read_at", null);
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

/** Only marks the row if it belongs to `profileId`. */
export async function markNotificationRead(id: string, profileId: string): Promise<void> {
  check(
    await db()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", profileId)
      .is("read_at", null)
      .select("id")
  );
}

export async function markAllRead(profileId: string): Promise<void> {
  check(
    await db()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("read_at", null)
      .select("id")
  );
}

/** Negotiation ids (of those given) this person already has a `kind` notification for. */
export async function notifiedNegotiationIds(profileId: string, kind: NotificationKind, negotiationIds: string[]): Promise<Set<string>> {
  if (negotiationIds.length === 0) return new Set();
  const rows: { negotiation_id: string | null }[] = check(
    await db()
      .from("notifications")
      .select("negotiation_id")
      .eq("profile_id", profileId)
      .eq("kind", kind)
      .in("negotiation_id", negotiationIds)
  );
  return new Set(rows.map((r) => r.negotiation_id).filter((x): x is string => !!x));
}
