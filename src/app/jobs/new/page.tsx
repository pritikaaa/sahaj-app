import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobForm } from "@/components/job-form";
import { VerificationBadge } from "@/components/badges";
import { getProfile } from "@/lib/data";
import { formatNPR } from "@/lib/format";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ helper?: string }> }) {
  const { helper: helperId } = await searchParams;
  const me = await currentProfile();
  if (!me) redirect("/");
  const helper = helperId ? await getProfile(helperId) : null;
  const usable = helper && helper.offers_help && helper.id !== me.id ? helper : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{usable ? `Hire ${usable.full_name}` : "Post a job"}</h1>
      <Card>
        <CardHeader>
          {usable ? (
            <>
              <CardTitle className="flex flex-wrap items-center gap-2">Booking with {usable.full_name} <VerificationBadge p={usable} /></CardTitle>
              <CardDescription>
                Your offer goes straight to {usable.full_name.split(" ")[0]}. You both have one minute to agree a price.
                {usable.min_price ? ` Their usual minimum is ${formatNPR(usable.min_price)}.` : ""}
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Job details</CardTitle>
              <CardDescription>Helpers browse open jobs and send you offers. You choose who to book.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <JobForm
            today={today}
            defaultArea={me.area}
            helper={usable ? { id: usable.id, first: usable.full_name.split(" ")[0], chores: usable.chores, min_price: usable.min_price } : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
