"use server";

import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { PRICE_CHANGED, respond, secondsLeft, startNegotiation, type Response } from "@/lib/negotiation";
import { currentProfileId, setCurrentProfile } from "@/lib/session";
import { parsePrice, validateJobInput, validateProfileInput, validateVerification } from "@/lib/validation";
import { toPublic, type PublicProfile } from "@/lib/public-profile";
import { noticeText, respondNotices, startNotices, type Notice } from "@/lib/notifications";
import type { Job, Negotiation, Notification, NotificationKind, Result, SosEvent, SosStatus } from "@/lib/types";

const fail = (error: string) => ({ ok: false as const, error });
const ok = <T>(value: T) => ({ ok: true as const, value });

/** Today's date in Pokhara (Asia/Kathmandu), YYYY-MM-DD. */
function todayInNepal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("negotiation expired")) return "Time is up — this offer lapsed after one minute.";
  if (msg.includes("negotiations_one_active_idx")) return "You already have a live negotiation on this job.";
  if (msg.includes("violates check constraint")) return "Some values are outside the allowed range.";
  return msg;
}

// ---------------------------------------------------------------- notifications (internal)
/** Save one in-app notification. Never throws: a failed notification must not break an offer. */
async function notify(
  profileId: string,
  kind: NotificationKind,
  title: string,
  body: string | null,
  negotiationId: string | null
): Promise<void> {
  try {
    await data.insertNotification({ profile_id: profileId, kind, title, body, negotiation_id: negotiationId });
  } catch {
    // swallowed on purpose
  }
}

/** Write each notice with names from the recipient's side. Never throws. */
async function notifyAll(
  notices: Notice[],
  n: Pick<Negotiation, "id" | "job_id" | "hirer_id" | "helper_id" | "current_price">,
  price = n.current_price
): Promise<void> {
  try {
    const [job, people] = await Promise.all([data.getJob(n.job_id), data.getProfilesById([n.hirer_id, n.helper_id])]);
    await Promise.all(
      notices.map(({ to, kind }) => {
        const otherId = to === n.hirer_id ? n.helper_id : n.hirer_id;
        const t = noticeText(kind, {
          otherName: people.get(otherId)?.full_name ?? "Someone",
          jobTitle: job?.title ?? "Job",
          price,
        });
        return notify(to, kind, t.title, t.body, n.id);
      })
    );
  } catch {
    // swallowed on purpose
  }
}

/**
 * Lapses have no action to hook into, so when this person's bell loads we look for
 * sessions that ran out in the last hour and add one "lapsed" item per session.
 * Idempotent: skips sessions already notified (a unique index backs this up).
 */
async function syncLapsed(meId: string): Promise<void> {
  try {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const lapsed = (await data.negotiationsInvolving(meId)).filter(
      (n) => n.status === "expired" && Date.parse(n.closed_at ?? n.expires_at) > cutoff
    );
    if (lapsed.length === 0) return;
    const done = await data.notifiedNegotiationIds(meId, "lapsed", lapsed.map((n) => n.id));
    for (const n of lapsed) {
      if (!done.has(n.id)) await notifyAll([{ to: meId, kind: "lapsed" }], n);
    }
  } catch {
    // swallowed on purpose
  }
}

/** A just-created job whose first negotiation failed: remove it so it doesn't sit Open with no offer. */
async function discardJob(jobId: string): Promise<void> {
  try {
    await data.deleteJob(jobId);
  } catch {
    try {
      await data.updateJobIf(jobId, ["open"], { status: "cancelled" });
    } catch {
      // nothing more to do; the original error is what the user sees
    }
  }
}

async function requireMe(): Promise<Result<string>> {
  const id = await currentProfileId();
  if (!id) return fail("Choose who you are first (top right).");
  const me = await data.getProfile(id);
  if (!me) {
    await setCurrentProfile(null);
    return fail("That person no longer exists. Choose again.");
  }
  return ok(id);
}

// ---------------------------------------------------------------- people
export async function createProfileAction(raw: Record<string, unknown>): Promise<Result<{ id: string }>> {
  const v = validateProfileInput(raw);
  if (!v.ok) return v;
  try {
    const p = await data.insertProfile(v.value);
    await setCurrentProfile(p.id);
    revalidatePath("/", "layout");
    return ok({ id: p.id });
  } catch (e) {
    return fail(friendly(e));
  }
}

export async function switchProfileAction(id: string | null): Promise<Result<null>> {
  if (id) {
    const p = await data.getProfile(id);
    if (!p) return fail("Person not found.");
  }
  await setCurrentProfile(id);
  revalidatePath("/", "layout");
  return ok(null);
}

/** Names for the demo "Switch person" menu. Names only, nothing private. */
export async function listPeopleAction(): Promise<{ id: string; full_name: string }[]> {
  try {
    const meId = await currentProfileId();
    return (await data.listProfiles()).filter((p) => p.id !== meId).map((p) => ({ id: p.id, full_name: p.full_name }));
  } catch {
    return [];
  }
}

export async function saveProfileAction(raw: Record<string, unknown>): Promise<Result<null>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const v = validateProfileInput(raw);
  if (!v.ok) return v;
  try {
    const before = await data.getProfile(me.value);
    const patch: Record<string, unknown> = { ...v.value };
    // Switching student/adult invalidates the ID check that was done.
    if (before && before.is_student !== v.value.is_student && before.verification_status !== "unverified") {
      Object.assign(patch, {
        verification_status: "unverified",
        verification_type: null,
        verification_number: null,
        verification_issuer: null,
        verification_submitted_at: null,
      });
    }
    await data.updateProfile(me.value, patch);
    revalidatePath("/", "layout");
    return ok(null);
  } catch (e) {
    return fail(friendly(e));
  }
}

export async function submitVerificationAction(raw: Record<string, unknown>): Promise<Result<null>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const profile = await data.getProfile(me.value);
  if (!profile) return fail("Profile not found.");
  if (profile.verification_status === "verified") return fail("You are already verified.");
  const v = validateVerification({ ...raw, is_student: profile.is_student } as Parameters<typeof validateVerification>[0]);
  if (!v.ok) return v;
  await data.updateProfile(me.value, {
    verification_type: v.value.verification_type,
    verification_number: v.value.verification_number,
    verification_issuer: v.value.verification_issuer,
    verification_status: "pending",
    verification_submitted_at: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  return ok(null);
}

/** Team desk: approve or reject an ID after checking it manually. */
export async function reviewVerificationAction(profileId: string, decision: "verified" | "rejected"): Promise<Result<null>> {
  const p = await data.getProfile(profileId);
  if (!p) return fail("Person not found.");
  if (p.verification_status !== "pending") return fail("Nothing pending for this person.");
  await data.updateProfile(profileId, { verification_status: decision });
  revalidatePath("/", "layout");
  return ok(null);
}

// ---------------------------------------------------------------- jobs
/**
 * Post a job. With `invitedHelperId` the family is hiring someone they browsed:
 * the job is reserved for that helper and a one-minute negotiation opens at once.
 */
export async function postJobAction(
  raw: Record<string, unknown>,
  invitedHelperId?: string | null
): Promise<Result<{ jobId: string; negotiationId: string | null }>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const v = validateJobInput(raw, todayInNepal());
  if (!v.ok) return v;

  if (invitedHelperId) {
    if (invitedHelperId === me.value) return fail("You can't hire yourself.");
    const helper = await data.getProfile(invitedHelperId);
    if (!helper || !helper.offers_help) return fail("That helper is not available.");
  }
  let jobId: string | null = null;
  let negotiationId: string | null = null;
  try {
    const job = await data.insertJob({ ...v.value, poster_id: me.value, invited_helper_id: invitedHelperId ?? null });
    jobId = job.id;
    if (invitedHelperId) {
      const n = startNegotiation({
        job, hirerId: me.value, helperId: invitedHelperId, actorId: me.value, price: v.value.budget, now: new Date(),
      });
      if (!n.ok) {
        await discardJob(job.id);
        return n;
      }
      const row = await data.insertNegotiation(n.value);
      negotiationId = row.id;
      await notifyAll(startNotices(row), row);
    }
    revalidatePath("/", "layout");
    return ok({ jobId: job.id, negotiationId });
  } catch (e) {
    // Hiring a chosen helper is one step for the family: if the offer couldn't be saved, don't leave the job behind.
    if (jobId && invitedHelperId && !negotiationId) await discardJob(jobId);
    return fail(friendly(e));
  }
}

/** A helper who browsed an open job makes an opening offer (starts the 1-minute clock). */
export async function makeOfferAction(jobId: string, priceInput: unknown): Promise<Result<{ negotiationId: string }>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const price = parsePrice(priceInput);
  if (!price.ok) return price;
  const helper = await data.getProfile(me.value);
  if (!helper?.offers_help) return fail("Turn on “I also offer help” in your profile to take jobs.");
  const job = await data.getJob(jobId);
  if (!job) return fail("Job not found.");

  const existing = await data.activeNegotiationFor(jobId, me.value);
  if (existing) return ok({ negotiationId: existing.id });

  const n = startNegotiation({ job, hirerId: job.poster_id, helperId: me.value, actorId: me.value, price: price.value, now: new Date() });
  if (!n.ok) return n;
  try {
    const row = await data.insertNegotiation(n.value);
    await notifyAll(startNotices(row), row);
    revalidatePath("/", "layout");
    return ok({ negotiationId: row.id });
  } catch (e) {
    return fail(friendly(e));
  }
}

/** Retry after a lapse: hirer re-opens a session with the same helper on an open job. */
export async function reopenNegotiationAction(negotiationId: string, priceInput: unknown): Promise<Result<{ negotiationId: string }>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const old = await data.getNegotiation(negotiationId);
  if (!old) return fail("Negotiation not found.");
  if (me.value !== old.hirer_id && me.value !== old.helper_id) return fail("You are not part of this negotiation.");
  const price = parsePrice(priceInput);
  if (!price.ok) return price;
  const job = await data.getJob(old.job_id);
  if (!job) return fail("Job not found.");
  const existing = await data.activeNegotiationFor(job.id, old.helper_id);
  if (existing) return ok({ negotiationId: existing.id });
  const n = startNegotiation({ job, hirerId: old.hirer_id, helperId: old.helper_id, actorId: me.value, price: price.value, now: new Date() });
  if (!n.ok) return n;
  try {
    const row = await data.insertNegotiation(n.value);
    await notifyAll(startNotices(row), row);
    revalidatePath("/", "layout");
    return ok({ negotiationId: row.id });
  } catch (e) {
    return fail(friendly(e));
  }
}

export interface NegotiationView {
  negotiation: Negotiation;
  job: Job;
  hirer: PublicProfile;
  helper: PublicProfile;
  meId: string | null;
  secondsLeft: number;
}

export async function getNegotiationViewAction(id: string): Promise<Result<NegotiationView>> {
  const n = await data.getNegotiation(id);
  if (!n) return fail("Negotiation not found.");
  const [job, people, meId] = await Promise.all([
    data.getJob(n.job_id),
    data.getProfilesById([n.hirer_id, n.helper_id]),
    currentProfileId(),
  ]);
  const hirer = people.get(n.hirer_id);
  const helper = people.get(n.helper_id);
  if (!job || !hirer || !helper) return fail("This negotiation is missing its job or people.");
  return ok({
    negotiation: n,
    job,
    hirer: toPublic(hirer),
    helper: toPublic(helper),
    meId,
    secondsLeft: secondsLeft(n, new Date()),
  });
}

/**
 * `asId` is the person this screen is showing. The demo "acting as" cookie is shared by every
 * tab in the browser, so if someone switched person in another tab we refuse rather than
 * act for the wrong person.
 */
export async function respondAction(id: string, r: Response, asId?: string | null): Promise<Result<NegotiationView>> {
  const me = await requireMe();
  if (!me.ok) return me;
  if (asId && asId !== me.value) {
    const now = await data.getProfile(me.value);
    return fail(
      `This browser is now acting as ${now?.full_name ?? "someone else"} (switched in another tab), so nothing was sent. Check the screen and try again.`
    );
  }
  const n = await data.getNegotiation(id);
  if (!n) return fail("Negotiation not found.");
  const decided = respond(n, me.value, r, new Date());
  if (!decided.ok) return decided;

  try {
    if (r.type === "accept") {
      // 1) book the job only if still open (first accept wins)
      const booked = await data.updateJobIf(n.job_id, ["open"], {
        status: "booked",
        helper_id: n.helper_id,
        agreed_price: n.current_price,
        booked_at: new Date().toISOString(),
      });
      if (!booked) {
        await data.updateActiveNegotiation(id, { status: "declined", closed_at: new Date().toISOString() });
        return fail("Someone else was booked for this job first.");
      }
      // 2) accept the session only if the price is still the one read above —
      //    the DB trigger re-checks the minute
      try {
        const accepted = await data.updateActiveNegotiation(id, decided.value, n.offer_count);
        if (!accepted) {
          const now = await data.getNegotiation(id);
          throw new Error(now?.status === "active" ? PRICE_CHANGED : "This negotiation just closed.");
        }
      } catch (e) {
        await data.updateJobIf(n.job_id, ["booked"], { status: "open", helper_id: null, agreed_price: null, booked_at: null });
        return fail(friendly(e));
      }
      await data.declineOtherActive(n.job_id, id);
    } else {
      // Counters are guarded the same way; a decline goes through whatever the price.
      const updated = await data.updateActiveNegotiation(id, decided.value, r.type === "counter" ? n.offer_count : undefined);
      if (!updated) {
        const now = await data.getNegotiation(id);
        return fail(r.type === "counter" && now?.status === "active" ? PRICE_CHANGED : "This negotiation just closed.");
      }
    }
  } catch (e) {
    return fail(friendly(e));
  }
  await notifyAll(respondNotices(r.type, me.value, n), n, r.type === "counter" ? r.price : n.current_price);
  revalidatePath("/", "layout");
  return getNegotiationViewAction(id);
}

export interface LiveItem {
  id: string;
  jobTitle: string;
  otherName: string;
  price: number;
  myTurn: boolean;
  offerCount: number;
  expiresAt: string;
}

/** Polled by the header banner so neither side misses a one-minute offer. */
export async function liveNegotiationsAction(): Promise<LiveItem[]> {
  const meId = await currentProfileId();
  if (!meId) return [];
  try {
    const live = await data.negotiationsInvolving(meId, true);
    if (live.length === 0) return [];
    const [jobs, people] = await Promise.all([
      data.getJobsById(live.map((n) => n.job_id)),
      data.getProfilesById(live.flatMap((n) => [n.hirer_id, n.helper_id])),
    ]);
    return live.map((n) => {
      const otherId = n.hirer_id === meId ? n.helper_id : n.hirer_id;
      return {
        id: n.id,
        jobTitle: jobs.get(n.job_id)?.title ?? "Job",
        otherName: people.get(otherId)?.full_name ?? "Someone",
        price: n.current_price,
        myTurn: n.last_offer_by !== meId,
        offerCount: n.offer_count,
        expiresAt: n.expires_at,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- notification bell
export type NotificationItem = Pick<Notification, "id" | "negotiation_id" | "kind" | "title" | "body" | "read_at" | "created_at">;

/** Polled by the header bell. Also records any of this person's offers that just lapsed. */
export async function listNotificationsAction(): Promise<Result<{ items: NotificationItem[]; unread: number }>> {
  const meId = await currentProfileId();
  if (!meId) return ok({ items: [], unread: 0 });
  try {
    await syncLapsed(meId);
    const [rows, unread] = await Promise.all([data.listNotifications(meId), data.unreadNotificationCount(meId)]);
    return ok({
      items: rows.map(({ id, negotiation_id, kind, title, body, read_at, created_at }) => ({
        id, negotiation_id, kind, title, body, read_at, created_at,
      })),
      unread,
    });
  } catch (e) {
    return fail(friendly(e));
  }
}

export async function markNotificationReadAction(id: string): Promise<Result<null>> {
  const me = await requireMe();
  if (!me.ok) return me;
  try {
    await data.markNotificationRead(id, me.value);
    return ok(null);
  } catch (e) {
    return fail(friendly(e));
  }
}

export async function markAllNotificationsReadAction(): Promise<Result<null>> {
  const me = await requireMe();
  if (!me.ok) return me;
  try {
    await data.markAllRead(me.value);
    return ok(null);
  } catch (e) {
    return fail(friendly(e));
  }
}

// ---------------------------------------------------------------- bookings
const NEXT_STATUS: Record<string, { from: Job["status"][]; who: "helper" | "poster" | "either" }> = {
  in_progress: { from: ["booked"], who: "helper" },
  completed: { from: ["in_progress", "booked"], who: "either" },
  cancelled: { from: ["open", "booked"], who: "either" },
};

export async function setJobStatusAction(jobId: string, status: "in_progress" | "completed" | "cancelled"): Promise<Result<null>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const job = await data.getJob(jobId);
  if (!job) return fail("Job not found.");
  const rule = NEXT_STATUS[status];
  const isPoster = job.poster_id === me.value;
  const isHelper = job.helper_id === me.value;
  if (rule.who === "helper" && !isHelper) return fail("Only the booked helper can start the job.");
  if (rule.who === "either" && !isPoster && !isHelper) return fail("You are not part of this booking.");
  if (status === "cancelled" && job.status === "open" && !isPoster) return fail("Only the poster can cancel an open job.");
  const updated = await data.updateJobIf(jobId, rule.from, { status });
  if (!updated) return fail(`Can't move a ${job.status.replace("_", " ")} job to ${status.replace("_", " ")}.`);
  revalidatePath("/", "layout");
  return ok(null);
}

// ---------------------------------------------------------------- SOS
export async function raiseSosAction(
  jobId: string | null,
  loc: { latitude?: number | null; longitude?: number | null; accuracy?: number | null; message?: string | null }
): Promise<Result<SosEvent>> {
  const me = await requireMe();
  if (!me.ok) return me;
  let job: Job | null = null;
  if (jobId) {
    job = await data.getJob(jobId);
    if (!job) return fail("Booking not found.");
    if (job.poster_id !== me.value && job.helper_id !== me.value) return fail("SOS is available to the two people in this booking.");
    if (!["booked", "in_progress"].includes(job.status)) return fail("SOS is available during an active booking.");
  } else {
    // Raised from the SOS page: attach the person's active booking if they have one.
    job = await data.activeBookingFor(me.value);
  }
  const profile = await data.getProfile(me.value);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const sos = await data.insertSos({
    job_id: job?.id ?? null,
    raised_by: me.value,
    latitude: num(loc.latitude),
    longitude: num(loc.longitude),
    accuracy_m: num(loc.accuracy),
    message: (loc.message ?? "").toString().trim().slice(0, 300) || null,
    contact_name: profile?.trusted_contact_name ?? null,
    contact_phone: profile?.trusted_contact_phone ?? null,
    status: "open",
  });
  revalidatePath("/", "layout");
  return ok(sos);
}

export async function updateSosAction(id: string, status: Exclude<SosStatus, "open">): Promise<Result<null>> {
  await data.updateSos(id, { status, resolved_at: status === "resolved" ? new Date().toISOString() : null });
  revalidatePath("/", "layout");
  return ok(null);
}

export async function openSosCountAction(): Promise<number> {
  try {
    return (await data.listSos(["open"])).length;
  } catch {
    return 0;
  }
}
