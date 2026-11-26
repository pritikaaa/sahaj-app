"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Repeat, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPeopleAction, switchProfileAction } from "@/app/actions";

/** Shows only the user's name; clicking opens Profile and a demo "Switch person" list (not auth). */
export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ id: string; full_name: string }[] | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listPeopleAction()
      .then((p) => alive && setPeople(p))
      .catch(() => alive && setPeople([]));
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const switchTo = (id: string) =>
    start(async () => {
      const r = await switchProfileAction(id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setOpen(false);
      router.push("/");
      router.refresh();
    });

  const item = "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm";

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="max-w-24 truncate text-base sm:max-w-52">{name}</span>
        <ChevronDown className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="bg-popover text-popover-foreground absolute right-0 z-40 mt-1 w-56 rounded-md border p-1 shadow-md">
          <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}>
            <UserRound className="size-4" aria-hidden /> Profile
          </Link>
          <div className="border-border my-1 border-t" />
          <p className="text-muted-foreground flex items-center gap-2 px-2.5 pt-1.5 pb-1 text-xs font-medium">
            <Repeat className="size-3.5" aria-hidden /> Switch person (demo)
          </p>
          <div className="max-h-60 overflow-y-auto">
            {people === null ? (
              <p className="text-muted-foreground px-2.5 py-2 text-sm">Loading…</p>
            ) : people.length === 0 ? (
              <p className="text-muted-foreground px-2.5 py-2 text-sm">No other people yet.</p>
            ) : (
              people.map((p) => (
                <button key={p.id} role="menuitem" type="button" disabled={pending} className={item} onClick={() => switchTo(p.id)}>
                  <span className="truncate">{p.full_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
