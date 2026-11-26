"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Find help", match: (p: string) => p === "/" || p.startsWith("/helpers") },
  { href: "/jobs", label: "Find work", match: (p: string) => p === "/jobs" || (p.startsWith("/jobs/") && p !== "/jobs/new") },
  { href: "/activity", label: "My activity", match: (p: string) => p.startsWith("/activity") },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-6 sm:gap-10 lg:gap-14">
        {LINKS.map(({ href, label, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block py-2.5 text-[15px] font-medium whitespace-nowrap sm:text-base md:py-1",
                  active ? "text-primary font-semibold" : "text-foreground/80 hover:text-foreground"
                )}
              >
                {label}
                {active && <span aria-hidden className="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full md:-bottom-2" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
