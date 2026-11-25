"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Home, ListChecks, PlusCircle, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/helpers", label: "Hire help", icon: Users },
  { href: "/jobs", label: "Find work", icon: Briefcase },
  { href: "/jobs/new", label: "Post a job", icon: PlusCircle },
  { href: "/activity", label: "My activity", icon: ListChecks },
  { href: "/desk", label: "Team desk", icon: ShieldCheck },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="mx-auto max-w-5xl overflow-x-auto px-2">
      <ul className="flex min-w-max gap-1 pb-1.5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path === href || (href !== "/jobs" && path.startsWith(href + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
                  active && "bg-secondary text-secondary-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
