import Link from "next/link";
import { Siren } from "lucide-react";
import { listProfiles } from "@/lib/data";
import { currentProfile } from "@/lib/session";
import { openSosCountAction } from "@/app/actions";
import { PersonSwitcher } from "./person-switcher";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  let people: { id: string; full_name: string }[] = [];
  let configured = true;
  try {
    people = (await listProfiles()).map((p) => ({ id: p.id, full_name: p.full_name }));
  } catch {
    configured = false;
  }
  const me = configured ? await currentProfile() : null;
  const sosCount = configured ? await openSosCountAction() : 0;

  return (
    <header className="bg-card/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-sm font-bold">
            स
          </span>
          <span className="text-lg">Sahaj</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {sosCount > 0 && (
            <Link
              href="/desk"
              className="bg-destructive flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-white"
              aria-label={`${sosCount} open SOS alerts`}
            >
              <Siren className="size-3.5" /> {sosCount} SOS
            </Link>
          )}
          {configured && <PersonSwitcher people={people} currentId={me?.id ?? null} />}
        </div>
      </div>
      <NavLinks />
    </header>
  );
}
