import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FindHelp } from "@/components/find-help";
import { SetupNeeded } from "@/components/setup-needed";
import { listHelpers } from "@/lib/data";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", t: "Choose each other", d: "Families browse helpers. Helpers browse jobs. Both sides decide who they work with." },
  { n: "02", t: "Make it fit your home", d: "Choose multiple chores and one-time or recurring help. Recurring jobs aren’t auto-scheduled." },
  { n: "03", t: "Agree, then confirm", d: "Propose a price, accept, counter, or decline. Each negotiation session expires after 1 minute." },
];

export default async function Home() {
  const me = await currentProfile();
  let helpers;
  try {
    helpers = await listHelpers({ excludeId: me?.id ?? null });
  } catch (e) {
    return <SetupNeeded message={e instanceof Error ? e.message : String(e)} />;
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="bg-hero grid overflow-hidden rounded-3xl md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5 px-6 py-8 sm:px-11 sm:py-10">
          <p className="text-secondary-foreground text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">Household help, close to home</p>
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">A little help. A lighter day.</h1>
          <p className="max-w-xl text-lg leading-relaxed text-[#645a50] sm:text-xl">
            Find household help in Pokhara that fits your needs. Browse, choose, and agree on a price together.
          </p>
          <p className="bg-background inline-block rounded-full px-4 py-2 text-sm text-[#675849]">For families. For local helpers.</p>
        </div>
        <div className="relative min-h-56 md:min-h-full">
          <Image src="/images/hero.jpg" alt="Two women folding laundry together at a wooden table" fill priority sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
        </div>
      </section>

      <FindHelp
        helpers={helpers.map((h) => ({
          id: h.id,
          full_name: h.full_name,
          bio: h.bio,
          area: h.area,
          chores: h.chores,
          is_student: h.is_student,
        }))}
        signedIn={!!me}
        defaultArea={me?.area ?? null}
        today={today}
      />

      {/* How it works */}
      <section id="how-it-works" className="bg-band -mx-4 -mb-16 scroll-mt-24 px-4 py-12 sm:-mx-8 sm:px-8 lg:-mx-20 lg:px-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A simpler way to get help.</h2>
          <Link href={me ? "/profile" : "/signup"} className="text-primary inline-flex items-center gap-1.5 font-semibold hover:underline">
            Looking for work? Join as a helper <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="text-primary pt-1 font-semibold">{s.n}</span>
              <div className="space-y-3">
                <h3 className="text-xl font-semibold">{s.t}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
