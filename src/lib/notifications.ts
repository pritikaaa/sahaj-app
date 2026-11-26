// Pure notification rules: who is told what, and which live offers to pop up.
// No I/O here so it is unit-tested; actions.ts and live-banner.tsx call it.
import { formatNPR } from "./format";
import type { Negotiation, NotificationKind } from "./types";

export interface Notice {
  to: string;
  kind: NotificationKind;
}

/** A session just opened: the other side has an offer to answer, the starter gets a receipt. */
export function startNotices(n: Pick<Negotiation, "hirer_id" | "helper_id" | "started_by">): Notice[] {
  const other = n.started_by === n.hirer_id ? n.helper_id : n.hirer_id;
  return [
    { to: other, kind: "offer_received" },
    { to: n.started_by, kind: "offer_sent" },
  ];
}

/** Someone answered: counters and declines go to the other side; an accept tells both. */
export function respondNotices(
  type: "counter" | "accept" | "decline",
  actorId: string,
  n: Pick<Negotiation, "hirer_id" | "helper_id">
): Notice[] {
  const other = actorId === n.hirer_id ? n.helper_id : n.hirer_id;
  if (type === "counter") return [{ to: other, kind: "countered" }];
  if (type === "decline") return [{ to: other, kind: "declined" }];
  return [
    { to: other, kind: "accepted" },
    { to: actorId, kind: "accepted" },
  ];
}

/**
 * Text for one recipient. `otherName` is the *other* person from the recipient's side.
 * Names, job title and price only: never phone numbers, IDs or trusted contacts.
 */
export function noticeText(
  kind: NotificationKind,
  ctx: { otherName: string; jobTitle: string; price: number }
): { title: string; body: string } {
  const { otherName, jobTitle, price } = ctx;
  const npr = formatNPR(price);
  switch (kind) {
    case "offer_received":
      return { title: `New offer from ${otherName}`, body: `${jobTitle} · ${npr} · reply within 1 minute` };
    case "offer_sent":
      return { title: `Offer sent to ${otherName}`, body: `${jobTitle} · ${npr}` };
    case "countered":
      return { title: `${otherName} countered`, body: `${jobTitle} · now ${npr}` };
    case "accepted":
      return { title: "Offer accepted", body: `${jobTitle} with ${otherName} · ${npr}` };
    case "declined":
      return { title: `${otherName} declined`, body: jobTitle };
    case "lapsed":
      return { title: "Offer lapsed", body: `${jobTitle} with ${otherName} · the minute ran out` };
  }
}

// ---------------------------------------------------------------- live popups
export interface LiveOffer {
  id: string;
  myTurn: boolean;
  offerCount: number;
  expiresAt: string;
}

export interface Announcement<T extends LiveOffer> {
  item: T;
  kind: "turn" | "sent";
}

/**
 * Which live offers should pop a toast now. Mutates `announced` so each one fires once:
 * - "turn": once per incoming offer (a counter is a new offer), skipped silently if
 *   the person is already on that negotiation page.
 * - "sent": once per negotiation, for the opening offer only.
 */
export function pickAnnouncements<T extends LiveOffer>(
  items: T[],
  announced: Set<string>,
  path: string,
  now: number
): Announcement<T>[] {
  const out: Announcement<T>[] = [];
  for (const item of items) {
    if (Date.parse(item.expiresAt) <= now) continue;
    const key = item.myTurn ? `${item.id}:${item.offerCount}:turn` : `${item.id}:sent`;
    if (announced.has(key)) continue;
    if (!item.myTurn && item.offerCount > 1) continue;
    announced.add(key);
    if (item.myTurn && path === `/negotiations/${item.id}`) continue;
    out.push({ item, kind: item.myTurn ? "turn" : "sent" });
  }
  return out;
}

/** Live offers waiting on this person, excluding the one they are looking at. Drives the tab title. */
export function unansweredCount(items: LiveOffer[], path: string, now: number): number {
  return items.filter((i) => i.myTurn && Date.parse(i.expiresAt) > now && path !== `/negotiations/${i.id}`).length;
}
