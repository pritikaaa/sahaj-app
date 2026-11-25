"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { ChorePicker } from "./chore-picker";
import { AREAS, PRICE_FLOOR, WEEKDAYS } from "@/lib/constants";
import { postJobAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function JobForm({
  today,
  defaultArea,
  helper,
}: {
  today: string;
  defaultArea: string | null;
  helper?: { id: string; first: string; chores: string[]; min_price: number | null } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: "",
    chores: [] as string[],
    frequency: "one_time",
    recurring_days: [] as string[],
    start_date: today,
    start_time: "09:00",
    area: defaultArea ?? "",
    address: "",
    notes: "",
    budget: helper?.min_price ? String(helper.min_price) : "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleDay = (d: string) =>
    set("recurring_days", f.recurring_days.includes(d) ? f.recurring_days.filter((x) => x !== d) : [...f.recurring_days, d]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await postJobAction(f, helper?.id ?? null);
      if (!r.ok) return void toast.error(r.error);
      if (r.value.negotiationId) {
        toast.success(`Offer sent to ${helper?.first}. You have one minute to agree.`);
        router.push(`/negotiations/${r.value.negotiationId}`);
      } else {
        toast.success("Job posted — helpers can now offer.");
        router.push(`/jobs/${r.value.jobId}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Job details">
      <ChorePicker legend="What needs doing? (pick one or more)" value={f.chores} onChange={(v) => set("chores", v)} options={helper?.chores.length ? helper.chores : undefined} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">How often?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {[
            { v: "one_time", l: "One-time" },
            { v: "daily", l: "Daily" },
            { v: "weekly", l: "Weekly" },
          ].map(({ v, l }) => (
            <label key={v} className={cn("cursor-pointer rounded-md border px-3 py-2 text-sm", f.frequency === v && "border-primary bg-secondary")}>
              <input type="radio" name="frequency" value={v} checked={f.frequency === v} onChange={() => set("frequency", v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
        {f.frequency === "weekly" && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Days of the week">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                role="checkbox"
                aria-checked={f.recurring_days.includes(d)}
                onClick={() => toggleDay(d)}
                className={cn("size-11 rounded-full border text-sm", f.recurring_days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background")}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">{f.frequency === "one_time" ? "Date" : "Starting from"}</Label>
          <Input id="start_date" type="date" min={today} required value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start_time">Time</Label>
          <Input id="start_time" type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">Area</Label>
          <NativeSelect id="area" required value={f.area} onChange={(e) => set("area", e.target.value)}>
            <option value="">Choose area…</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Address / landmark (shared after booking)</Label>
          <Input id="address" value={f.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget">{helper ? "Your opening offer" : "Budget"} (NPR per visit)</Label>
          <Input id="budget" inputMode="numeric" required placeholder={`${PRICE_FLOOR} minimum`} value={f.budget} onChange={(e) => set("budget", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title (optional)</Label>
          <Input id="title" maxLength={80} placeholder="e.g. Saturday deep clean" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" maxLength={500} placeholder="Rooms, kids, pets, languages…" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : helper ? `Send offer to ${helper.first} (1-minute deal)` : "Post job"}
      </Button>
    </form>
  );
}
