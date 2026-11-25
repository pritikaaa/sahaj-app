import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { OfferForm } from "@/components/offer-form";
import { SetupNeeded } from "@/components/setup-needed";
import { CHORES } from "@/lib/constants";
import { getProfilesById, listOpenJobs } from "@/lib/data";
import { describeSchedule, formatNPR, timeAgo } from "@/lib/format";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ chore?: string }> }) {
  const sp = await searchParams;
  const me = await currentProfile();
  let jobs, posters;
  try {
    jobs = await listOpenJobs({ excludePosterId: me?.id, chore: sp.chore || null });
    posters = await getProfilesById(jobs.map((j) => j.poster_id));
  } catch (e) {
    return <SetupNeeded message={e instanceof Error ? e.message : String(e)} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find work</h1>
        <p className="text-muted-foreground text-sm">Open jobs from families in Pokhara. Choose one, name your price, agree within a minute.</p>
      </div>

      {me && !me.offers_help && (
        <Card className="border-warning">
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1">To take jobs, turn on “I also offer help” in your profile. You can keep hiring too.</span>
            <Button asChild size="sm"><Link href="/profile">Edit profile</Link></Button>
          </CardContent>
        </Card>
      )}

      <form className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3" aria-label="Filter jobs">
        <div className="min-w-40 flex-1 space-y-1">
          <label htmlFor="chore" className="text-sm font-medium">Chore</label>
          <NativeSelect id="chore" name="chore" defaultValue={sp.chore ?? ""}>
            <option value="">Any chore</option>
            {CHORES.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      {jobs.length === 0 ? (
        <Card><CardContent className="text-muted-foreground py-6 text-center text-sm">No open jobs right now. Check back soon — or make sure your profile lists your chores so families can hire you directly.</CardContent></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {jobs.map((j) => {
            const poster = posters.get(j.poster_id);
            return (
              <li key={j.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle><Link href={`/jobs/${j.id}`} className="hover:underline">{j.title}</Link></CardTitle>
                    <CardDescription className="space-y-1">
                      <span className="flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /> {describeSchedule(j)}</span>
                      <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {j.area} · by {poster?.full_name ?? "a family"} · {timeAgo(j.created_at)}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">{j.chores.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                    <p className="text-sm">Budget <strong>{formatNPR(j.budget)}</strong> per visit</p>
                    {j.notes && <p className="text-muted-foreground line-clamp-2 text-sm">{j.notes}</p>}
                  </CardContent>
                  <CardFooter className="mt-auto">
                    {me?.offers_help ? <OfferForm jobId={j.id} suggested={j.budget} /> : (
                      <Button asChild variant="outline" size="sm"><Link href={me ? "/profile" : "/"}>{me ? "Offer help to take this job" : "Choose who you are"}</Link></Button>
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
