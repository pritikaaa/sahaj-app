"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer } from "lucide-react";
import { liveNegotiationsAction, type LiveItem } from "@/app/actions";
import { formatNPR } from "@/lib/format";

/** Polls every 2.5 s so a one-minute offer is never missed on any page. */
export function LiveBanner() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const path = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () => liveNegotiationsAction().then((r) => alive && setItems(r)).catch(() => {});
    load();
    const poll = setInterval(load, 2500);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [path]);

  const visible = items.filter((i) => Date.parse(i.expiresAt) > now && !path.endsWith(i.id));
  if (visible.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl space-y-2 px-4 pt-3">
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
