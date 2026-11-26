import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobStatusBadge, NegotiationBadge } from "@/components/badges";
import { AutoRefresh } from "@/components/auto-refresh";
import { getJobsById, getProfilesById, jobsPostedBy, jobsWorkedBy, negotiationsInvolving } from "@/lib/data";
import { describeSchedule, formatNPR, timeAgo } from "@/lib/format";
import { currentProfile } from "@/lib/session";
import type { Job, Negotiation, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function JobRow({ job, extra }: { job: Job; extra?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">{job.title}</Link>
        <p className="text-muted-foreground text-xs">{describeSchedule(job)} · {formatNPR(job.agreed_price ?? job.budget)}{extra ? ` · ${extra}` : ""}</p>
      </div>
      <JobStatusBadge status={job.status} />
    </li>
  );
}

function NegRow({ n, jobs, people, meId }: { n: Negotiation; jobs: Map<string, Job>; people: Map<string, Profile>; meId: string }) {
  const otherId = n.hirer_id === meId ? n.helper_id : n.hirer_id;
  const myTurn = n.status === "active" && n.last_offer_by !== meId;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{jobs.get(n.job_id)?.title ?? "Job"} <span className="text-muted-foreground font-normal">with {people.get(otherId)?.full_name}</span></p>
        <p className="text-muted-foreground text-xs">{formatNPR(n.current_price)} · {timeAgo(n.created_at)}{myTurn ? " · your turn" : ""}</p>
      </div>
      <NegotiationBadge status={n.status} />
      <Button asChild size="sm" variant={n.status === "active" ? "default" : "outline"}><Link href={`/negotiations/${n.id}`}>Open</Link></Button>
    </li>
  );
}

function Section({ title, empty, children, count }: { title: string; empty: React.ReactNode; children: React.ReactNode; count: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>{count === 0 ? <p className="text-muted-foreground text-sm">{empty}</p> : <ul className="divide-y">{children}</ul>}</CardContent>
    </Card>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const me = await currentProfile();
  if (!me) redirect("/signup");
  const [posted, working, negs] = await Promise.all([jobsPostedBy(me.id), jobsWorkedBy(me.id), negotiationsInvolving(me.id)]);
  const [jobs, people] = await Promise.all([
    getJobsById(negs.map((n) => n.job_id)),
    getProfilesById(negs.flatMap((n) => [n.hirer_id, n.helper_id])),
  ]);
  const asHirer = negs.filter((n) => n.hirer_id === me.id);
  const asHelper = negs.filter((n) => n.helper_id === me.id);
  const taken = working.filter((j) => j.status !== "cancelled");
  const stats = [
    {
      label: "Jobs posted",
      value: posted.length,
      note: `${posted.filter((j) => j.status === "open").length} still open · ${posted.filter((j) => j.status === "completed").length} completed`,
    },
    {
      label: "Jobs taken so far",
      value: taken.length,
      note: `${taken.filter((j) => j.status === "booked" || j.status === "in_progress").length} upcoming or in progress`,
    },
    { label: "Jobs completed", value: taken.filter((j) => j.status === "completed").length, note: "As a helper" },
  ];
  const liveCount = (list: Negotiation[], jobId: string) => list.filter((n) => n.job_id === jobId && n.status === "active").length;

  return (
    <div className="space-y-4">
      <AutoRefresh everyMs={5000} />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My activity</h1>
      <section aria-label="Your dashboard" className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, note }) => (
          <Card key={label}>
            <CardContent className="space-y-1">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="text-4xl font-semibold tabular-nums">{value}</p>
              <p className="text-muted-foreground text-xs">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Tabs defaultValue={tab === "working" ? "working" : "hiring"}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="hiring">Hiring ({posted.length})</TabsTrigger>
          <TabsTrigger value="working">Working ({working.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="hiring" className="space-y-4">
          <Section title="Jobs I posted" count={posted.length} empty={<>None yet. <Link className="text-primary underline" href="/jobs/new">Post a job</Link> or <Link className="text-primary underline" href="/helpers">browse helpers</Link>.</>}>
            {posted.map((j) => {
              const live = liveCount(asHirer, j.id);
              return <JobRow key={j.id} job={j} extra={live ? `${live} live offer${live > 1 ? "s" : ""}` : undefined} />;
            })}
          </Section>
          <Section title="Price talks as hirer" count={asHirer.length} empty="No offers yet.">
            {asHirer.map((n) => <NegRow key={n.id} n={n} jobs={jobs} people={people} meId={me.id} />)}
          </Section>
        </TabsContent>
        <TabsContent value="working" className="space-y-4">
          {!me.offers_help && (
            <Card><CardContent className="text-sm">Turn on “I also offer help” in your <Link className="text-primary underline" href="/profile">profile</Link> to take jobs.</CardContent></Card>
          )}
          <Section title="My bookings as helper" count={working.length} empty={<>No bookings yet. <Link className="text-primary underline" href="/jobs">Find work</Link>.</>}>
            {working.map((j) => <JobRow key={j.id} job={j} />)}
          </Section>
          <Section title="Price talks as helper" count={asHelper.length} empty="No offers yet.">
            {asHelper.map((n) => <NegRow key={n.id} n={n} jobs={jobs} people={people} meId={me.id} />)}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
