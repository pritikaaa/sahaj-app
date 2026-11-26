import Link from "next/link";
import { currentProfile } from "@/lib/session";
import { UserMenu } from "./user-menu";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const me = await currentProfile();

  return (
    <header className="bg-card sticky top-0 z-30 border-b">
      <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-sm font-bold">
            स
          </span>
          <span className="font-display text-2xl font-bold">Sahaj</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {me && <UserMenu name={me.full_name} />}
        </div>
      </div>
      <NavLinks />
    </header>
  );
}
