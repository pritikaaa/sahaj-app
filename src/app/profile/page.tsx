import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { VerificationForm } from "@/components/verification-form";
import { VerificationBadge } from "@/components/badges";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await currentProfile();
  if (!me) redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>{me.full_name}</CardTitle>
          <CardDescription>Same profile for hiring and for working.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm mode="edit" initial={me} />
        </CardContent>
      </Card>

      {me.offers_help && (
        <Card id="verify">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Verification <VerificationBadge p={me} />
            </CardTitle>
            <CardDescription>
              {me.is_student ? "Students: verify with your student ID to get the “Verified student” badge." : "Adults: verify with a government ID to get the “ID verified” badge."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {me.verification_status === "verified" && <p className="text-sm">You are verified. Families see your badge first in search.</p>}
            {me.verification_status === "pending" && (
              <p className="text-sm">
                Submitted ({me.verification_type === "student_id" ? "student ID" : "government ID"} from {me.verification_issuer}). The team will review it on the{" "}
                <Link className="text-primary underline" href="/desk">team desk</Link>.
              </p>
            )}
            {(me.verification_status === "unverified" || me.verification_status === "rejected") && (
              <>
                {me.verification_status === "rejected" && <p className="text-destructive mb-3 text-sm">Your last submission was rejected. Check the number and try again.</p>}
                <VerificationForm isStudent={me.is_student} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
