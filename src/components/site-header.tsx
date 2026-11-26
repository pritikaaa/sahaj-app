import Link from "next/link";
import { Siren } from "lucide-react";
import { currentProfile } from "@/lib/session";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const me = await currentProfile();

  return (
    <header className="bg-background sticky top-0 z-30">
      <div className="border-border mx-4 flex items-center gap-3 border-b py-3 sm:mx-8 sm:py-5 lg:mx-20">
        <Link href="/" className="text-primary text-3xl leading-none font-bold tracking-tight sm:text-4xl">
          sahaj
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <NavLinks />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-4 md:ml-0">
          <span className="text-muted-foreground hidden text-sm lg:inline">Pokhara, Nepal</span>
          <Link
            href="/sos"
            className="bg-destructive hover:bg-destructive/90 ring-destructive/30 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold tracking-wide text-white shadow-sm hover:ring-4 sm:text-base"
          >
            <Siren className="size-4 motion-safe:animate-pulse sm:size-5" aria-hidden /> SOS
          </Link>
          {me ? (
            <>
              <NotificationBell key={me.id} />
              <UserMenu name={me.full_name} />
            </>
          ) : (
            <>
              <button
                type="button"
                disabled
                title="Log in is not available yet"
                className="text-foreground hidden cursor-not-allowed px-1 text-base font-medium opacity-60 sm:inline"
              >
                Log in
              </button>
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold sm:px-6 sm:py-2.5 sm:text-base"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="border-border mx-4 border-b md:hidden sm:mx-8">
        <NavLinks />
      </div>
    </header>
  );
}
