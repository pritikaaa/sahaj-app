"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchProfileAction } from "@/app/actions";

export function PickPerson({ people }: { people: { id: string; full_name: string; area: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue as</CardTitle>
        <CardDescription>Demo mode: pick a person on this device.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {people.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => { await switchProfileAction(p.id); router.refresh(); })}
          >
            {p.full_name}{p.area ? <span className="text-muted-foreground">· {p.area}</span> : null}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
