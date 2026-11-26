"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { liveNegotiationsAction, type LiveItem } from "@/app/actions";
import { formatNPR } from "@/lib/format";
import { pickAnnouncements, unansweredCount } from "@/lib/notifications";

const POLL_MS = 1500;
const STORE_KEY = "sahaj_announced";
const TITLE_PREFIX = /^\(\d+\) New offer: /;

/** Ids already popped up, kept for this tab so a reload or route change never repeats a toast. */
function loadAnnounced(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveAnnounced(s: Set<string>) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    // storage blocked: de-duplication still works for this page view
  }
}

/** Optional ping if public/ping.mp3 exists. Browsers may block audio before a click; that's fine. */
let pingAvailable: Promise<boolean> | null = null;
function ping() {
  try {
    pingAvailable ??= fetch("/ping.mp3", { method: "HEAD" }).then((r) => r.ok).catch(() => false);
    pingAvailable.then((ok) => {
      if (ok) new Audio("/ping.mp3").play().catch(() => {});
    });
  } catch {
    // no audio support
  }
}

/**
 * Polls every 1.5 s so a one-minute offer is never missed on any page.
 * Rendered only while a person is selected (see layout.tsx).
 */
export function LiveBanner() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const path = usePathname();
  const router = useRouter();
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    announced.current ??= loadAnnounced();
    // Opening the negotiation answers the popup.
    if (path.startsWith("/negotiations/")) toast.dismiss(`offer-${path.split("/")[2]}`);
    const load = () =>
      liveNegotiationsAction()
        .then((r) => {
          if (!alive) return;
          setItems(r);
          const set = announced.current!;
          const fresh = pickAnnouncements(r, set, path, Date.now());
          saveAnnounced(set);
          for (const { item: i, kind } of fresh) {
            const msLeft = Math.max(1000, Date.parse(i.expiresAt) - Date.now());
            const go = { label: kind === "turn" ? "Respond" : "View", onClick: () => router.push(`/negotiations/${i.id}`) };
            if (kind === "turn") {
              toast(`New offer from ${i.otherName}`, {
                id: `offer-${i.id}`,
                description: `${i.jobTitle} · ${formatNPR(i.price)} · ${Math.ceil(msLeft / 1000)}s left`,
                duration: msLeft,
                action: go,
              });
              ping();
            } else {
              toast.message(`Offer sent to ${i.otherName}`, { id: `sent-${i.id}`, duration: 4000, action: go });
            }
          }
        })
        .catch(() => {});
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [path, router]);

  // "(1) New offer: Sahaj" in the tab while an offer waits on this person.
  const original = useRef<string | null>(null);
  const waiting = unansweredCount(items, path, now);
  useEffect(() => {
    if (waiting > 0) {
      if (!TITLE_PREFIX.test(document.title)) original.current = document.title;
      document.title = `(${waiting}) New offer: Sahaj`;
    } else if (TITLE_PREFIX.test(document.title)) {
      document.title = original.current ?? document.title.replace(TITLE_PREFIX, "");
    }
  }, [waiting]);
  useEffect(
    () => () => {
      if (TITLE_PREFIX.test(document.title) && original.current) document.title = original.current;
    },
    []
  );

  const visible = items.filter((i) => Date.parse(i.expiresAt) > now && !path.endsWith(i.id));
  if (visible.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="w-full space-y-2 px-4 pt-3 sm:px-8 lg:px-20">
      {visible.map((i) => {
        const left = Math.max(0, Math.ceil((Date.parse(i.expiresAt) - now) / 1000));
        return (
          <Link
            key={i.id}
            href={`/negotiations/${i.id}`}
            className={
              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm " +
              (i.myTurn ? "border-primary bg-secondary" : "bg-card")
            }
          >
            <Timer className="text-primary size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              <strong>{i.myTurn ? "Your turn: " : "Waiting: "}</strong>
              {i.otherName} · {i.jobTitle} · {formatNPR(i.price)}
            </span>
            <span className="text-primary font-mono font-semibold tabular-nums">{left}s</span>
          </Link>
        );
      })}
    </div>
  );
}
