import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentProfile()) redirect("/profile");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign up</h1>
        <p className="text-muted-foreground">One profile can hire help and offer help.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create your profile</CardTitle>
          <CardDescription>No password needed in this demo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
