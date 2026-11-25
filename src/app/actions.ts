"use server";

import { revalidatePath } from "next/cache";
import * as data from "@/lib/data";
import { respond, secondsLeft, startNegotiation, type Response } from "@/lib/negotiation";
import { currentProfileId, setCurrentProfile } from "@/lib/session";
import { parsePrice, validateJobInput, validateProfileInput, validateVerification } from "@/lib/validation";
import { toPublic, type PublicProfile } from "@/lib/public-profile";
import type { Job, Negotiation, Result, SosEvent, SosStatus } from "@/lib/types";

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
  try {
    const job = await data.insertJob({ ...v.value, poster_id: me.value, invited_helper_id: invitedHelperId ?? null });
    let negotiationId: string | null = null;
    if (invitedHelperId) {
      const n = startNegotiation({
        job, hirerId: me.value, helperId: invitedHelperId, actorId: me.value, price: v.value.budget, now: new Date(),
      });
      if (!n.ok) return n;
      negotiationId = (await data.insertNegotiation(n.value)).id;
    }
    revalidatePath("/", "layout");
    return ok({ jobId: job.id, negotiationId });
  } catch (e) {
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

export async function respondAction(id: string, r: Response): Promise<Result<NegotiationView>> {
  const me = await requireMe();
  if (!me.ok) return me;
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
      // 2) accept the session — the DB trigger re-checks the minute
      try {
        const accepted = await data.updateActiveNegotiation(id, decided.value);
        if (!accepted) throw new Error("This negotiation just closed.");
      } catch (e) {
        await data.updateJobIf(n.job_id, ["booked"], { status: "open", helper_id: null, agreed_price: null, booked_at: null });
        return fail(friendly(e));
      }
      await data.declineOtherActive(n.job_id, id);
    } else {
      const updated = await data.updateActiveNegotiation(id, decided.value);
      if (!updated) return fail("This negotiation just closed.");
    }
  } catch (e) {
    return fail(friendly(e));
  }
  revalidatePath("/", "layout");
  return getNegotiationViewAction(id);
}

export interface LiveItem {
  id: string;
  jobTitle: string;
  otherName: string;
  price: number;
  myTurn: boolean;
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
        expiresAt: n.expires_at,
      };
    });
  } catch {
    return [];
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
  jobId: string,
  loc: { latitude?: number | null; longitude?: number | null; accuracy?: number | null; message?: string | null }
): Promise<Result<SosEvent>> {
  const me = await requireMe();
  if (!me.ok) return me;
  const job = await data.getJob(jobId);
  if (!job) return fail("Booking not found.");
  if (job.poster_id !== me.value && job.helper_id !== me.value) return fail("SOS is available to the two people in this booking.");
  if (!["booked", "in_progress"].includes(job.status)) return fail("SOS is available during an active booking.");
  const profile = await data.getProfile(me.value);
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const sos = await data.insertSos({
    job_id: jobId,
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
