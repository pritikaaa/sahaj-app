// Pure M1 negotiation rules. The server actions call these with the server
// clock; the database trigger in schema.sql enforces the timer a second time.
import { MAX_OFFERS, NEGOTIATION_SECONDS } from "./constants";
import { validatePrice } from "./validation";
import type { Job, Negotiation, NegotiationStatus, Result } from "./types";

export type NewNegotiation = Omit<Negotiation, "id" | "created_at" | "closed_at">;
/**
 * `expectedOfferCount` is the offer_count of the view the person is looking at.
 * If the price changed since, the response is refused so nobody accepts a price they didn't see.
 */
export type Response =
  | { type: "counter"; price: number; expectedOfferCount?: number }
  | { type: "accept"; expectedOfferCount?: number }
  | { type: "decline" };

export const PRICE_CHANGED = "The price just changed, check the new offer.";

const fail = (error: string) => ({ ok: false as const, error });

export function startNegotiation(args: {
  job: Job;
  hirerId: string;
  helperId: string;
  actorId: string;
  price: number;
  now: Date;
}): Result<NewNegotiation> {
  const { job, hirerId, helperId, actorId, price, now } = args;
  if (job.status !== "open") return fail("This job is no longer open.");
  if (hirerId !== job.poster_id) return fail("Only the person who posted the job can hire for it.");
  if (helperId === hirerId) return fail("You can't hire yourself for your own job.");
  if (actorId !== hirerId && actorId !== helperId) return fail("You are not part of this job.");
  if (job.invited_helper_id && job.invited_helper_id !== helperId) return fail("This job is reserved for another helper.");
  const priceError = validatePrice(price);
  if (priceError) return fail(priceError);

  const at = now.toISOString();
  return {
    ok: true,
    value: {
      job_id: job.id,
      hirer_id: hirerId,
      helper_id: helperId,
      started_by: actorId,
      current_price: price,
      last_offer_by: actorId,
      offer_count: 1,
      history: [{ by: actorId, action: "offer", price, at }],
      status: "active",
      expires_at: new Date(now.getTime() + NEGOTIATION_SECONDS * 1000).toISOString(),
    },
  };
}

export function effectiveStatus(n: Pick<Negotiation, "status" | "expires_at">, now: Date): NegotiationStatus {
  if (n.status === "active" && now.getTime() > Date.parse(n.expires_at)) return "expired";
  return n.status;
}

export function secondsLeft(n: Pick<Negotiation, "status" | "expires_at">, now: Date): number {
  if (effectiveStatus(n, now) !== "active") return 0;
  return Math.max(0, Math.ceil((Date.parse(n.expires_at) - now.getTime()) / 1000));
}

export function respond(n: Negotiation, actorId: string, r: Response, now: Date): Result<Partial<Negotiation>> {
  if (actorId !== n.hirer_id && actorId !== n.helper_id) return fail("You are not part of this negotiation.");
  const status = effectiveStatus(n, now);
  if (status === "expired") return fail("Time is up — this offer lapsed after one minute.");
  if (status !== "active") return fail(`This negotiation is already closed (${status}).`);

  const at = now.toISOString();
  if (r.type === "decline") {
    return {
      ok: true,
      value: {
        status: "declined",
        closed_at: at,
        history: [...n.history, { by: actorId, action: "decline", price: n.current_price, at }],
      },
    };
  }
  if (r.expectedOfferCount !== undefined && r.expectedOfferCount !== n.offer_count) return fail(PRICE_CHANGED);

  if (r.type === "accept") {
    if (actorId === n.last_offer_by) return fail("You can't accept your own offer.");
    return {
      ok: true,
      value: {
        status: "accepted",
        closed_at: at,
        history: [...n.history, { by: actorId, action: "accept", price: n.current_price, at }],
      },
    };
  }

  const priceError = validatePrice(r.price);
  if (priceError) return fail(priceError);
  if (r.price === n.current_price) return fail("That is the current offer — accept it or offer a different price.");
  // Either side may counter, including changing their own standing offer; each one counts.
  if (n.offer_count >= MAX_OFFERS) return fail("No counters left — accept or decline.");
  return {
    ok: true,
    value: {
      current_price: r.price,
      last_offer_by: actorId,
      offer_count: n.offer_count + 1,
      history: [...n.history, { by: actorId, action: "counter", price: r.price, at }],
    },
  };
}
