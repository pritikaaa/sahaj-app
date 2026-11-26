import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { currentProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await currentProfile();
  if (!me) redirect("/signup");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>{me.full_name}</CardTitle>
          <CardDescription>Same profile for hiring and for working.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm mode="edit" initial={me} />
        </CardContent>
      </Card>
    </div>
  );
}
