"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationItem,
} from "@/app/actions";

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Header bell: unread count + recent negotiation outcomes. Refreshes every 5 s like AutoRefresh. */
export function NotificationBell({ everyMs = 5000 }: { everyMs?: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const r = await listNotificationsAction();
      if (r.ok) {
        setItems(r.value.items);
        setUnread(r.value.unread);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch {
      setError("Couldn't load notifications.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, everyMs);
    return () => clearInterval(t);
  }, [load, everyMs]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n: NotificationItem) => {
    setOpen(false);
    if (!n.read_at) {
      setItems((xs) => xs?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
      markNotificationReadAction(n.id).catch(() => {});
    }
    if (n.negotiation_id) router.push(`/negotiations/${n.negotiation_id}`);
  };

  const readAll = () => {
    setItems((xs) => xs?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null);
    setUnread(0);
    markAllNotificationsReadAction().then(load).catch(() => {});
  };

  const now = Date.now();
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 min-w-5 rounded-full px-1 text-center text-xs leading-5 font-semibold tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div role="menu" className="bg-popover text-popover-foreground absolute right-0 z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md border p-1 shadow-md">
          <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="text-primary text-xs font-medium hover:underline" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {error && !items ? (
              <p className="text-destructive px-2.5 py-3 text-sm">{error}</p>
            ) : items === null ? (
              <p className="text-muted-foreground px-2.5 py-3 text-sm">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground px-2.5 py-3 text-sm">No notifications yet. Offers and their outcomes show up here.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  role="menuitem"
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full gap-2 rounded-sm px-2.5 py-2 text-left text-sm",
                    !n.read_at && "bg-secondary/60"
                  )}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{n.title}</span>
                    {n.body && <span className="text-muted-foreground block truncate">{n.body}</span>}
                    <span className="text-muted-foreground block text-xs">{ago(n.created_at, now)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
