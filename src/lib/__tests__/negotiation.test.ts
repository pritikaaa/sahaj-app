import { describe, expect, it } from "vitest";
import { PRICE_CHANGED, respond, secondsLeft, startNegotiation, effectiveStatus } from "../negotiation";
import type { Job, Negotiation } from "../types";

const HIRER = "hirer-1";
const HELPER = "helper-1";
const T0 = new Date("2026-11-24T10:00:00.000Z");
const at = (s: number) => new Date(T0.getTime() + s * 1000);

const job = (over: Partial<Job> = {}): Job => ({
  id: "job-1", created_at: T0.toISOString(), poster_id: HIRER, invited_helper_id: null,
  helper_id: null, title: "Cleaning", chores: ["Cleaning"], frequency: "one_time",
  recurring_days: [], start_date: "2026-11-25", start_time: "09:00", area: "Lakeside",
  address: null, notes: null, budget: 800, agreed_price: null, status: "open", booked_at: null,
  ...over,
});

function started(price = 800, actor = HELPER): Negotiation {
  const r = startNegotiation({ job: job(), hirerId: HIRER, helperId: HELPER, actorId: actor, price, now: T0 });
  if (!r.ok) throw new Error(r.error);
  return { id: "n-1", created_at: T0.toISOString(), closed_at: null, ...r.value };
}
const apply = (n: Negotiation, patch: Partial<Negotiation>): Negotiation => ({ ...n, ...patch });

describe("startNegotiation", () => {
  it("opens a one-minute session with the opening offer", () => {
    const n = started(900);
    expect(n.status).toBe("active");
    expect(n.current_price).toBe(900);
    expect(n.last_offer_by).toBe(HELPER);
    expect(n.offer_count).toBe(1);
    expect(n.expires_at).toBe(at(60).toISOString());
    expect(n.history).toEqual([{ by: HELPER, action: "offer", price: 900, at: T0.toISOString() }]);
  });

  it("lets the hirer start when inviting a helper they browsed", () => {
    const n = started(700, HIRER);
    expect(n.started_by).toBe(HIRER);
  });

  it("rejects hiring yourself (same person posting and working)", () => {
    const r = startNegotiation({ job: job(), hirerId: HIRER, helperId: HIRER, actorId: HIRER, price: 800, now: T0 });
    expect(r).toEqual({ ok: false, error: "You can't hire yourself for your own job." });
  });

  it("rejects jobs that are no longer open", () => {
    const r = startNegotiation({ job: job({ status: "booked" }), hirerId: HIRER, helperId: HELPER, actorId: HELPER, price: 800, now: T0 });
    expect(r.ok).toBe(false);
  });

  it("rejects a helper on a job reserved for another helper", () => {
    const r = startNegotiation({ job: job({ invited_helper_id: "other" }), hirerId: HIRER, helperId: HELPER, actorId: HELPER, price: 800, now: T0 });
    expect(r).toEqual({ ok: false, error: "This job is reserved for another helper." });
  });

  it("rejects outsiders and prices below the floor", () => {
    expect(startNegotiation({ job: job(), hirerId: HIRER, helperId: HELPER, actorId: "x", price: 800, now: T0 }).ok).toBe(false);
    const r = startNegotiation({ job: job(), hirerId: HIRER, helperId: HELPER, actorId: HELPER, price: 299, now: T0 });
    expect(r).toEqual({ ok: false, error: "Minimum price is NPR 300 per visit." });
  });
});

describe("respond", () => {
  it("lets the other side counter, then the first side accept", () => {
    let n = started(1000);
    const c = respond(n, HIRER, { type: "counter", price: 800 }, at(10));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    n = apply(n, c.value);
    expect(n.current_price).toBe(800);
    expect(n.last_offer_by).toBe(HIRER);
    expect(n.offer_count).toBe(2);

    const a = respond(n, HELPER, { type: "accept" }, at(20));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    n = apply(n, a.value);
    expect(n.status).toBe("accepted");
    expect(n.closed_at).toBe(at(20).toISOString());
    expect(n.history.map((h) => h.action)).toEqual(["offer", "counter", "accept"]);
  });

  it("does not let you accept your own offer", () => {
    const n = started(1000);
    expect(respond(n, HELPER, { type: "accept" }, at(5))).toEqual({ ok: false, error: "You can't accept your own offer." });
  });

  it("lets the same person counter twice (change their standing offer); each counts", () => {
    let n = started(1000);
    for (const p of [950, 900]) {
      const r = respond(n, HELPER, { type: "counter", price: p }, at(5));
      if (!r.ok) throw new Error(r.error);
      n = apply(n, r.value);
    }
    expect(n.current_price).toBe(900);
    expect(n.last_offer_by).toBe(HELPER);
    expect(n.offer_count).toBe(3);
    expect(respond(n, HELPER, { type: "accept" }, at(6)).ok).toBe(false);
    expect(respond(n, HIRER, { type: "accept" }, at(6)).ok).toBe(true);
  });

  it("refuses accept or counter made against a stale view", () => {
    let n = started(1000);
    const c = respond(n, HIRER, { type: "counter", price: 800, expectedOfferCount: 1 }, at(5));
    if (!c.ok) throw new Error(c.error);
    n = apply(n, c.value);
    // The helper's screen still shows offer 1 (NPR 1,000) when they tap Accept.
    expect(respond(n, HELPER, { type: "accept", expectedOfferCount: 1 }, at(6))).toEqual({ ok: false, error: PRICE_CHANGED });
    expect(respond(n, HELPER, { type: "counter", price: 900, expectedOfferCount: 1 }, at(6))).toEqual({ ok: false, error: PRICE_CHANGED });
    expect(respond(n, HELPER, { type: "accept", expectedOfferCount: 2 }, at(6)).ok).toBe(true);
  });

  it("cannot be accepted once the minute has passed", () => {
    const n = started(1000);
    expect(respond(n, HIRER, { type: "accept" }, at(59)).ok).toBe(true);
    expect(respond(n, HIRER, { type: "accept" }, at(61))).toEqual({ ok: false, error: "Time is up — this offer lapsed after one minute." });
  });

  it("expiry blocks counters (either side) and decline too", () => {
    const n = started(1000);
    const lapsed = { ok: false, error: "Time is up — this offer lapsed after one minute." };
    expect(respond(n, HIRER, { type: "counter", price: 900 }, at(61))).toEqual(lapsed);
    expect(respond(n, HELPER, { type: "counter", price: 900 }, at(61))).toEqual(lapsed);
    expect(respond(n, HIRER, { type: "decline" }, at(61))).toEqual(lapsed);
  });

  it("counters do not extend the one-minute window", () => {
    let n = started(1000);
    const c = respond(n, HIRER, { type: "counter", price: 900 }, at(50));
    if (!c.ok) throw new Error(c.error);
    n = apply(n, c.value);
    expect(n.expires_at).toBe(at(60).toISOString());
  });

  it("validates counter prices", () => {
    const n = started(1000);
    expect(respond(n, HIRER, { type: "counter", price: 100 }, at(5)).ok).toBe(false);
    expect(respond(n, HIRER, { type: "counter", price: 1000 }, at(5))).toEqual({ ok: false, error: "That is the current offer — accept it or offer a different price." });
    expect(respond(n, HIRER, { type: "counter", price: 50001 }, at(5)).ok).toBe(false);
  });

  it("caps the number of offers at 10 (the 10th succeeds, an 11th fails)", () => {
    let n = started(1000);
    const prices = [600, 950, 650, 900, 700, 880, 720, 860, 750];
    let who = HIRER;
    for (const p of prices) {
      const r = respond(n, who, { type: "counter", price: p }, at(5));
      if (!r.ok) throw new Error(r.error);
      n = apply(n, r.value);
      who = who === HIRER ? HELPER : HIRER;
    }
    expect(n.offer_count).toBe(10);
    expect(n.current_price).toBe(750);
    expect(respond(n, who, { type: "counter", price: 800 }, at(6))).toEqual({ ok: false, error: "No counters left — accept or decline." });
    expect(respond(n, who, { type: "accept" }, at(6)).ok).toBe(true);
  });

  it("lets either side decline (or withdraw) while active", () => {
    const n = started(1000);
    const d = respond(n, HELPER, { type: "decline" }, at(5));
    expect(d.ok && d.value.status).toBe("declined");
    expect(respond(n, "stranger", { type: "decline" }, at(5)).ok).toBe(false);
  });

  it("rejects responses to closed sessions", () => {
    const n = { ...started(1000), status: "accepted" as const };
    expect(respond(n, HIRER, { type: "decline" }, at(5))).toEqual({ ok: false, error: "This negotiation is already closed (accepted)." });
  });
});

describe("timer helpers", () => {
  it("counts down and reports expiry", () => {
    const n = started();
    expect(secondsLeft(n, T0)).toBe(60);
    expect(secondsLeft(n, new Date(T0.getTime() + 30_500))).toBe(30);
    expect(secondsLeft(n, at(90))).toBe(0);
    expect(effectiveStatus(n, at(30))).toBe("active");
    expect(effectiveStatus(n, at(61))).toBe("expired");
    expect(effectiveStatus({ ...n, status: "accepted" }, at(61))).toBe("accepted");
  });
});
