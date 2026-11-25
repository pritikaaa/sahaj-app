"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { switchProfileAction } from "@/app/actions";

export function PersonSwitcher({ people, currentId }: { people: { id: string; full_name: string }[]; currentId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(value: string) {
    if (value === "__new") {
      start(async () => {
        await switchProfileAction(null);
        router.push("/?new=1");
        router.refresh();
      });
      return;
    }
    start(async () => {
      const r = await switchProfileAction(value || null);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <label className="border-input bg-background flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm shadow-xs">
      <UserRound className="text-muted-foreground size-4" aria-hidden />
      <span className="sr-only">Acting as</span>
      <select
        aria-label="Acting as"
        className="max-w-36 bg-transparent outline-none sm:max-w-52"
        value={currentId ?? ""}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose person…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
        <option value="__new">+ New person</option>
      </select>
    </label>
  );
}
