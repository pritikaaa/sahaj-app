import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupNeeded({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Can&apos;t reach the database</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Run <code>supabase/schema.sql</code> in the Supabase SQL Editor.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and paste the Project URL and anon key.</li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
