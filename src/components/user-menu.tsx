"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows only the user's name; clicking opens Profile and Log out. Log out is a placeholder for now. */
export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const item = "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm";

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="max-w-36 truncate sm:max-w-52">{name}</span>
        <ChevronDown className={open ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden />
      </Button>
      {open && (
        <div role="menu" className="bg-popover text-popover-foreground absolute right-0 z-40 mt-1 w-44 rounded-md border p-1 shadow-md">
          <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}>
            <UserRound className="size-4" aria-hidden /> Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              toast.info("Log out isn't available yet.");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
