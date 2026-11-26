import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobStatusBadge, NegotiationBadge } from "@/components/badges";
import { JobActions } from "@/components/job-actions";
import { OfferForm } from "@/components/offer-form";
import { SosButton } from "@/components/sos-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { getJob, getProfilesById, negotiationsForJob, sosForJob } from "@/lib/data";
import { describeSchedule, formatNPR, timeAgo } from "@/lib/format";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const me = await currentProfile();
  const isPoster = me?.id === job.poster_id;
  const isHelper = !!me && me.id === job.helper_id;
  const negs = isPoster || me ? await negotiationsForJob(job.id) : [];
  const visibleNegs = isPoster ? negs : negs.filter((n) => n.helper_id === me?.id);
  const people = await getProfilesById([job.poster_id, job.helper_id ?? "", ...visibleNegs.map((n) => n.helper_id)]);
  const poster = people.get(job.poster_id);
  const helper = job.helper_id ? people.get(job.helper_id) : null;
  const active = job.status === "booked" || job.status === "in_progress";
  const sos = (isPoster || isHelper) ? await sosForJob(job.id) : [];

  return (
    <div className="space-y-4">
      {job.status === "open" && isPoster && <AutoRefresh everyMs={4000} />}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">{job.title} <JobStatusBadge status={job.status} /></CardTitle>
          <CardDescription className="space-y-1">
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden /> {describeSchedule(job)}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {job.area}{(isPoster || isHelper) && job.address ? ` · ${job.address}` : ""}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">{job.chores.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Posted by</dt><dd>{isPoster ? "You" : poster?.full_name}</dd></div>
            <div><dt className="text-muted-foreground">{job.agreed_price ? "Agreed price" : "Budget"}</dt><dd className="font-medium">{formatNPR(job.agreed_price ?? job.budget)} / visit</dd></div>
            {helper && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Helper</dt>
                <dd className="flex flex-wrap items-center gap-2">{isHelper ? "You" : helper.full_name}</dd>
              </div>
            )}
          </dl>
          {job.notes && <p className="text-muted-foreground text-sm">{job.notes}</p>}
          {(isPoster || isHelper) && <JobActions jobId={job.id} status={job.status} isPoster={isPoster} isHelper={isHelper} />}
          {job.status === "open" && me && !isPoster && me.offers_help && !job.invited_helper_id && <OfferForm jobId={job.id} suggested={job.budget} />}
        </CardContent>
      </Card>

      {active && (isPoster || isHelper) && (
        <Card>
          <CardHeader>
            <CardTitle>Safety</CardTitle>
            <CardDescription>Feel unsafe during this booking? One tap alerts the Sahaj team desk and shares your location.</CardDescription>
          </CardHeader>
          <CardContent><SosButton jobId={job.id} /></CardContent>
        </Card>
      )}

      {sos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">SOS on this booking</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {sos.map((s) => <li key={s.id}>{people.get(s.raised_by)?.full_name ?? "Someone"} · {timeAgo(s.created_at)} · <strong>{s.status}</strong></li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {visibleNegs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isPoster ? "Offers from helpers" : "Your offers"}</CardTitle>
            {isPoster && job.status === "open" && <CardDescription>Each offer is live for one minute. Open it to accept or counter.</CardDescription>}
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {visibleNegs.map((n) => {
                const h = people.get(n.helper_id);
                return (
                  <li key={n.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <strong>{h?.full_name}</strong>
                      <span className="text-muted-foreground"> · {formatNPR(n.current_price)} · {timeAgo(n.created_at)}</span>
                    </span>
                    <NegotiationBadge status={n.status} />
                    <Button asChild size="sm" variant={n.status === "active" ? "default" : "outline"}><Link href={`/negotiations/${n.id}`}>Open</Link></Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
