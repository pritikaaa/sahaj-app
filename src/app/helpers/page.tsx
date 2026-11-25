import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { VerificationBadge } from "@/components/badges";
import { SetupNeeded } from "@/components/setup-needed";
import { CHORES } from "@/lib/constants";
import { listHelpers } from "@/lib/data";
import { formatNPR } from "@/lib/format";
import { currentProfileId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HelpersPage({
  searchParams,
}: {
  searchParams: Promise<{ chore?: string; verified?: string; students?: string }>;
}) {
  const sp = await searchParams;
  const meId = await currentProfileId();
  let helpers;
  try {
    helpers = await listHelpers({
      excludeId: meId,
      chore: sp.chore || null,
      verifiedOnly: sp.verified === "1",
      studentsOnly: sp.students === "1",
    });
  } catch (e) {
    return <SetupNeeded message={e instanceof Error ? e.message : String(e)} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hire help</h1>
        <p className="text-muted-foreground text-sm">Browse helpers and choose who you want. Verified helpers are listed first.</p>
      </div>

      <form className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3" aria-label="Filter helpers">
        <div className="min-w-40 flex-1 space-y-1">
          <label htmlFor="chore" className="text-sm font-medium">Chore</label>
          <NativeSelect id="chore" name="chore" defaultValue={sp.chore ?? ""}>
            <option value="">Any chore</option>
            {CHORES.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="verified" value="1" defaultChecked={sp.verified === "1"} className="accent-primary size-4" /> Verified only
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="students" value="1" defaultChecked={sp.students === "1"} className="accent-primary size-4" /> Students
        </label>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      {helpers.length === 0 ? (
        <Card><CardContent className="text-muted-foreground py-6 text-center text-sm">No helpers match. Try another chore, or <Link className="text-primary underline" href="/jobs/new">post a job</Link> so helpers can find you.</CardContent></Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {helpers.map((h) => (
            <li key={h.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">{h.full_name} <VerificationBadge p={h} /></CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden /> {h.area ?? "Pokhara"}
                    {h.is_student && <span>· Student</span>}
                    {h.min_price && <span>· from {formatNPR(h.min_price)}/visit</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">{h.chores.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                  {h.bio && <p className="text-muted-foreground line-clamp-3 text-sm">{h.bio}</p>}
                </CardContent>
                <CardFooter className="mt-auto">
                  {meId ? (
                    <Button asChild className="w-full sm:w-auto"><Link href={`/jobs/new?helper=${h.id}`}>Hire {h.full_name.split(" ")[0]}</Link></Button>
                  ) : (
                    <Button asChild variant="outline"><Link href="/">Choose who you are to hire</Link></Button>
                  )}
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
