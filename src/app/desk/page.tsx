import Link from "next/link";
import { Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { ReviewButtons, SosButtons } from "@/components/desk-actions";
import { SetupNeeded } from "@/components/setup-needed";
import { getJobsById, getProfilesById, listPendingVerifications, listSos } from "@/lib/data";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Sahaj team only (no auth in MVP): SOS recipient + manual ID review. */
export default async function DeskPage() {
  let pending, sos;
  try {
    [pending, sos] = await Promise.all([listPendingVerifications(), listSos(["open", "acknowledged", "resolved"])]);
  } catch (e) {
    return <SetupNeeded message={e instanceof Error ? e.message : String(e)} />;
  }
  const [people, jobs] = await Promise.all([
    getProfilesById(sos.map((s) => s.raised_by)),
    getJobsById(sos.map((s) => s.job_id ?? "")),
  ]);
  const order = { open: 0, acknowledged: 1, resolved: 2 } as const;
  sos.sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-5">
      <AutoRefresh everyMs={5000} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team desk</h1>
        <p className="text-muted-foreground text-sm">For the Sahaj team: answer SOS alerts first, then review IDs. Refreshes every 5 seconds.</p>
      </div>

      <Card className={sos.some((s) => s.status === "open") ? "border-destructive" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Siren className="text-destructive size-5" aria-hidden /> SOS alerts</CardTitle>
          <CardDescription>Call the person first, then their trusted contact. Police: 100.</CardDescription>
        </CardHeader>
        <CardContent>
          {sos.length === 0 ? <p className="text-muted-foreground text-sm">No SOS alerts.</p> : (
            <ul className="divide-y">
              {sos.map((s) => {
                const p = people.get(s.raised_by);
                const j = s.job_id ? jobs.get(s.job_id) : null;
                return (
                  <li key={s.id} className="space-y-1.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.status === "open" ? "destructive" : s.status === "acknowledged" ? "warning" : "outline"}>{s.status}</Badge>
                      <strong>{p?.full_name ?? "Unknown"}</strong>
                      {p?.phone && <a className="text-primary underline" href={`tel:${p.phone}`}>{p.phone}</a>}
                      <span className="text-muted-foreground">· {timeAgo(s.created_at)}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {j ? <>Booking: <Link className="text-primary underline" href={`/jobs/${j.id}`}>{j.title}</Link> · {j.area}{j.address ? `, ${j.address}` : ""}</> : "No booking"}
                      {s.latitude != null && <> · <a className="text-primary underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}>map ({Math.round(s.accuracy_m ?? 0)} m)</a></>}
                      {s.contact_phone && <> · Trusted contact: {s.contact_name ?? "—"} <a className="text-primary underline" href={`tel:${s.contact_phone}`}>{s.contact_phone}</a></>}
                    </p>
                    <SosButtons id={s.id} status={s.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ID verification queue</CardTitle>
          <CardDescription>Check the card in person or on a video call before approving. Students: student ID. Adults: government ID.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? <p className="text-muted-foreground text-sm">Nothing to review.</p> : (
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.full_name} <span className="text-muted-foreground font-normal">· {p.is_student ? "Student" : "Adult"}</span></p>
                    <p className="text-muted-foreground">{p.verification_type === "student_id" ? "Student ID" : "Government ID"} {p.verification_number} · {p.verification_issuer}{p.verification_submitted_at ? ` · ${timeAgo(p.verification_submitted_at)}` : ""}</p>
                  </div>
                  <ReviewButtons profileId={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
