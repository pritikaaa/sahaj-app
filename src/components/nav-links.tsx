"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Home, ListChecks, PlusCircle, Siren, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home", short: "Home", icon: Home },
  { href: "/helpers", label: "Hire help", short: "Hire", icon: Users },
  { href: "/jobs", label: "Find work", short: "Work", icon: Briefcase },
  { href: "/jobs/new", label: "Post a job", short: "Post", icon: PlusCircle },
  { href: "/activity", label: "My activity", short: "Activity", icon: ListChecks },
];

export function NavLinks() {
  const path = usePathname();
  const sosActive = path === "/sos";
  return (
    <nav aria-label="Main" className="flex w-full items-center gap-1 px-2 pt-1 pb-2 sm:gap-2 sm:px-4 lg:px-8">
      {/* One line at every size: tabs shrink (and use short labels on phones); SOS stays on the right. */}
      <div className="min-w-0 flex-1">
        <ul className="flex flex-nowrap items-center gap-0.5 sm:gap-1 lg:gap-1.5">
          {LINKS.map(({ href, label, short, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path === href || (href !== "/jobs" && path.startsWith(href + "/"));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium whitespace-nowrap sm:px-2 sm:text-xs md:gap-1.5 md:text-sm lg:px-3 lg:py-2 lg:text-base xl:text-lg",
                    active && "bg-secondary text-secondary-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0 lg:size-5" aria-hidden />
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <Link
        href="/sos"
        aria-current={sosActive ? "page" : undefined}
        className={cn(
          "bg-destructive hover:bg-destructive/90 ring-destructive/30 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap text-white shadow-md ring-offset-2 hover:ring-4 sm:px-3 md:gap-1.5 md:text-sm lg:px-4 lg:py-2 lg:text-base xl:text-lg",
          sosActive && "ring-4"
        )}
      >
        <Siren className="size-4 motion-safe:animate-pulse lg:size-5" aria-hidden /> SOS
      </Link>
    </nav>
  );
}
