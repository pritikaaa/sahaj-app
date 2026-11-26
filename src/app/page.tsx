import Link from "next/link";
import { ArrowRight, Briefcase, CheckCircle2, ClipboardList, Handshake, Search, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { PickPerson } from "@/components/pick-person";
import { SetupNeeded } from "@/components/setup-needed";
import { VerificationBadge } from "@/components/badges";
import { jobsPostedBy, jobsWorkedBy, listHelpers, listOpenJobs, listProfiles, negotiationsInvolving } from "@/lib/data";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: wantsNew } = await searchParams;
  let people;
  try {
    people = await listProfiles();
  } catch (e) {
    return <SetupNeeded message={e instanceof Error ? e.message : String(e)} />;
  }
  const me = await currentProfile();

  if (!me) {
    return (
      <div className="space-y-6">
        <section className="space-y-2 pt-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Household help in Pokhara, on your terms</h1>
          <p className="text-muted-foreground max-w-2xl">
            Families browse verified helpers. Helpers and students browse jobs. Both sides choose, and agree a fair price in one minute.
          </p>
        </section>
        {people.length > 0 && !wantsNew && <PickPerson people={people.map((p) => ({ id: p.id, full_name: p.full_name, area: p.area }))} />}
        <Card>
          <CardHeader>
            <CardTitle>Create your profile</CardTitle>
            <CardDescription>No password needed in this demo. One profile can hire and work.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm mode="create" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [helpers, jobs, live, posted, worked] = await Promise.all([
    listHelpers({ excludeId: me.id }),
    listOpenJobs({ excludePosterId: me.id }),
    negotiationsInvolving(me.id, true),
    jobsPostedBy(me.id),
    jobsWorkedBy(me.id),
  ]);
  const taken = worked.filter((j) => j.status !== "cancelled");
  const stats = [
    {
      icon: ClipboardList,
      label: "Jobs posted",
      value: posted.length,
      note: `${posted.filter((j) => j.status === "open").length} still open · ${posted.filter((j) => j.status === "completed").length} completed`,
    },
    {
      icon: Briefcase,
      label: "Jobs taken so far",
      value: taken.length,
      note: `${taken.filter((j) => j.status === "booked" || j.status === "in_progress").length} upcoming or in progress`,
    },
    {
      icon: CheckCircle2,
      label: "Jobs completed",
      value: taken.filter((j) => j.status === "completed").length,
      note: "As a helper",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Namaste, {me.full_name.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm">{me.area ?? "Pokhara"} · hire help or find work — or both.</p>
        </div>
        {me.offers_help && <VerificationBadge p={me} />}
      </section>

      <section aria-label="Your dashboard" className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value, note }) => (
          <Card key={label} className="first:border-primary first:border-t-4">
            <CardContent className="space-y-1 text-center">
              <Icon className="text-primary mx-auto size-4" aria-hidden />
              <p className="font-display text-4xl font-bold tabular-nums">{value}</p>
              <p className="text-muted-foreground italic">{label}</p>
              <p className="text-muted-foreground text-xs">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {live.length > 0 && (
        <Card className="border-primary">
          <CardContent className="flex items-center gap-3">
            <Timer className="text-primary size-5" aria-hidden />
            <p className="flex-1 text-sm"><strong>{live.length}</strong> live price negotiation{live.length > 1 ? "s" : ""} — each lasts one minute.</p>
            <Button asChild size="sm"><Link href="/activity">Open</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="text-primary size-5" aria-hidden /> Hire help</CardTitle>
            <CardDescription>{helpers.length} helper{helpers.length === 1 ? "" : "s"} available · verified first</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild><Link href="/helpers"><Search aria-hidden /> Browse helpers</Link></Button>
            <Button asChild variant="outline"><Link href="/jobs/new">Post a job</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="text-primary size-5" aria-hidden /> Find work</CardTitle>
            <CardDescription>
              {me.offers_help
                ? `${jobs.length} open job${jobs.length === 1 ? "" : "s"} from other families`
                : "Turn on “I also offer help” in your profile to take paid gigs."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {me.offers_help ? (
              <Button asChild><Link href="/jobs"><Search aria-hidden /> Browse jobs</Link></Button>
            ) : (
              <Button asChild><Link href="/profile">Start offering help <ArrowRight aria-hidden /></Link></Button>
            )}
            {me.offers_help && me.verification_status !== "verified" && (
              <Button asChild variant="outline"><Link href="/profile#verify">Get verified</Link></Button>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="how" className="space-y-2">
        <h2 id="how" className="text-xl font-bold">How Sahaj works</h2>
        <ol className="grid gap-2 sm:grid-cols-3">
          {[
            { icon: Search, t: "Browse and choose", d: "Families pick helpers; helpers pick jobs. No auto-dispatch." },
            { icon: Handshake, t: "Agree a price in 1 minute", d: "Offer, counter, accept. NPR 300 minimum per visit." },
            { icon: Timer, t: "Book once or recurring", d: "Several chores per booking. SOS is one tap away." },
          ].map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="bg-card flex gap-2.5 rounded-md border px-3 py-2.5">
              <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-display text-base leading-snug font-bold">{i + 1}. {t}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
