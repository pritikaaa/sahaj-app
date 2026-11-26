import { describe, expect, it } from "vitest";
import { noticeText, pickAnnouncements, respondNotices, startNotices, unansweredCount } from "../notifications";

const N = { hirer_id: "hirer", helper_id: "helper" };

describe("startNotices", () => {
  it("hirer starts: helper receives, hirer gets a receipt", () => {
    expect(startNotices({ ...N, started_by: "hirer" })).toEqual([
      { to: "helper", kind: "offer_received" },
      { to: "hirer", kind: "offer_sent" },
    ]);
  });
  it("helper starts: hirer receives, helper gets a receipt", () => {
    expect(startNotices({ ...N, started_by: "helper" })).toEqual([
      { to: "hirer", kind: "offer_received" },
      { to: "helper", kind: "offer_sent" },
    ]);
  });
});

describe("respondNotices", () => {
  it("counter and decline go to the other side only", () => {
    expect(respondNotices("counter", "helper", N)).toEqual([{ to: "hirer", kind: "countered" }]);
    expect(respondNotices("decline", "hirer", N)).toEqual([{ to: "helper", kind: "declined" }]);
  });
  it("accept tells both people", () => {
    expect(respondNotices("accept", "hirer", N)).toEqual([
      { to: "helper", kind: "accepted" },
      { to: "hirer", kind: "accepted" },
    ]);
  });
});

describe("noticeText", () => {
  const ctx = { otherName: "Asha", jobTitle: "Deep clean", price: 1200 };
  it("has a title and body for every kind, with names and price only", () => {
    for (const kind of ["offer_received", "offer_sent", "countered", "accepted", "declined", "lapsed"] as const) {
      const t = noticeText(kind, ctx);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body).toContain("Deep clean");
    }
    expect(noticeText("offer_received", ctx)).toEqual({
      title: "New offer from Asha",
      body: "Deep clean · NPR 1,200 · reply within 1 minute",
    });
    expect(noticeText("countered", ctx).body).toContain("NPR 1,200");
  });
});

describe("pickAnnouncements", () => {
  const now = Date.parse("2026-11-26T10:00:00Z");
  const live = (over: Partial<{ id: string; myTurn: boolean; offerCount: number; expiresAt: string }>) => ({
    id: "n1",
    myTurn: true,
    offerCount: 1,
    expiresAt: "2026-11-26T10:00:45Z",
    ...over,
  });

  it("announces a new offer once, however many polls see it", () => {
    const seen = new Set<string>();
    expect(pickAnnouncements([live({})], seen, "/", now)).toHaveLength(1);
    expect(pickAnnouncements([live({})], seen, "/jobs", now)).toHaveLength(0);
    expect(pickAnnouncements([live({})], seen, "/", now + 1500)).toHaveLength(0);
  });

  it("a counter-offer is a new announcement", () => {
    const seen = new Set<string>();
    pickAnnouncements([live({})], seen, "/", now);
    expect(pickAnnouncements([live({ offerCount: 3 })], seen, "/", now)).toEqual([
      { item: live({ offerCount: 3 }), kind: "turn" },
    ]);
  });

  it("stays quiet on the negotiation page itself, and doesn't fire later", () => {
    const seen = new Set<string>();
    expect(pickAnnouncements([live({})], seen, "/negotiations/n1", now)).toHaveLength(0);
    expect(pickAnnouncements([live({})], seen, "/", now)).toHaveLength(0);
  });

  it("sent receipt only for the opening offer, once", () => {
    const seen = new Set<string>();
    expect(pickAnnouncements([live({ myTurn: false })], seen, "/negotiations/n1", now)).toEqual([
      { item: live({ myTurn: false }), kind: "sent" },
    ]);
    expect(pickAnnouncements([live({ myTurn: false })], seen, "/", now)).toHaveLength(0);
    expect(pickAnnouncements([live({ myTurn: false, offerCount: 2 })], new Set(), "/", now)).toHaveLength(0);
  });

  it("skips offers that already lapsed", () => {
    expect(pickAnnouncements([live({ expiresAt: "2026-11-26T09:59:59Z" })], new Set(), "/", now)).toHaveLength(0);
  });

  it("the other person on the same device still gets their own popup", () => {
    const seen = new Set<string>();
    pickAnnouncements([live({ myTurn: false })], seen, "/", now); // hirer: sent
    expect(pickAnnouncements([live({ myTurn: true })], seen, "/", now)).toHaveLength(1); // helper: new offer
  });
});

describe("unansweredCount", () => {
  const now = Date.parse("2026-11-26T10:00:00Z");
  const exp = "2026-11-26T10:00:30Z";
  it("counts live offers waiting on me, not the one I'm viewing", () => {
    const items = [
      { id: "a", myTurn: true, offerCount: 1, expiresAt: exp },
      { id: "b", myTurn: false, offerCount: 1, expiresAt: exp },
      { id: "c", myTurn: true, offerCount: 1, expiresAt: "2026-11-26T09:00:00Z" },
    ];
    expect(unansweredCount(items, "/", now)).toBe(1);
    expect(unansweredCount(items, "/negotiations/a", now)).toBe(0);
  });
});
