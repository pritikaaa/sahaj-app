"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { postJobAction } from "@/app/actions";
import { AREAS, CHORES, PRICE_FLOOR, WEEKDAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export type HelperCard = Pick<
  Profile,
  "id" | "full_name" | "bio" | "area" | "chores" | "is_student"
>;

const MAIN_CHORES = ["Cleaning", "Cooking", "Laundry", "Dishes"];
const MORE_CHORES = CHORES.filter((c) => !MAIN_CHORES.includes(c));

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function HelperBadge({ h }: { h: HelperCard }) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium";
  return <span className={cn(base, "bg-[#f3f0eb] text-[#6b6359]")}>{h.is_student ? "Student" : "Household helper"}</span>;
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-foreground mb-2 block text-[15px] font-medium">{children}</label>;
}

export function FindHelp({
  helpers,
  signedIn,
  defaultArea,
  today,
}: {
  helpers: HelperCard[];
  signedIn: boolean;
  defaultArea: string | null;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chores, setChores] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [location, setLocation] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState({
    title: "",
    area: defaultArea ?? "",
    recurring: false,
    start_date: today,
    start_time: "10:00",
    address: "",
    budget: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const toggleChore = (c: string) => setChores((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const visible = useMemo(
    () => helpers.filter((h) => chores.every((c) => h.chores.includes(c)) && (!location || h.area === location)),
    [helpers, chores, location]
  );
  const chosen = helpers.find((h) => h.id === chosenId) ?? null;

  function choose(id: string) {
    setChosenId(id);
    setStep(1);
  }

  function toNegotiate() {
    if (!signedIn) {
      toast.info("Sign up to book a helper.");
      return router.push("/signup");
    }
    if (!chosen) return void toast.error("Choose a helper from the list first.");
    if (chores.length === 0) return void toast.error("Pick at least one chore above.");
    if (!f.area) return void toast.error("Pick an area in Pokhara.");
    if (!f.start_date) return void toast.error("Pick a date.");
    setStep(2);
  }

  function startNegotiation(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    const weekday = WEEKDAYS[new Date(`${f.start_date}T00:00:00`).getDay()];
    start(async () => {
      const r = await postJobAction(
        {
          title: f.title,
          chores,
          frequency: f.recurring ? "weekly" : "one_time",
          recurring_days: f.recurring ? [weekday] : [],
          start_date: f.start_date,
          start_time: f.start_time,
          area: f.area,
          address: f.address,
          notes: "",
          budget: f.budget,
        },
        chosen.id
      );
      if (!r.ok) return void toast.error(r.error);
      if (r.value.negotiationId) {
        toast.success(`Offer sent to ${chosen.full_name.split(" ")[0]}. You have one minute to agree.`);
        router.push(`/negotiations/${r.value.negotiationId}`);
      } else {
        router.push(`/jobs/${r.value.jobId}`);
      }
    });
  }

  const chip = (c: string) => {
    const on = chores.includes(c);
    return (
      <button
        key={c}
        type="button"
        aria-pressed={on}
        onClick={() => toggleChore(c)}
        className={cn(
          "inline-flex h-12 items-center gap-2 rounded-full border px-5 text-base sm:px-6 sm:text-lg",
          on ? "border-primary/70 bg-secondary text-secondary-foreground" : "bg-card text-foreground/85 hover:bg-accent"
        )}
      >
        {on && <Check className="size-4" aria-hidden />} {c}
      </button>
    );
  };

  return (
    <div className="space-y-12">
      {/* What can we help with? */}
      <section aria-labelledby="help-with" className="space-y-4">
        <h2 id="help-with" className="text-xl font-semibold">What can we help with?</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-1 flex-wrap gap-3">
            {MAIN_CHORES.map(chip)}
            {showMore && MORE_CHORES.map(chip)}
            <button
              type="button"
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
              className="bg-card text-foreground/85 hover:bg-accent inline-flex h-12 items-center rounded-full border px-5 text-base sm:px-6 sm:text-lg"
            >
              {showMore ? "Fewer chores" : "More chores"}
            </button>
          </div>
          <label className="bg-card relative block w-full rounded-xl border px-5 py-2 sm:w-96">
            <span className="text-muted-foreground block text-xs">Location</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full appearance-none bg-transparent pr-6 text-lg outline-none"
            >
              <option value="">Pokhara, Nepal</option>
              {AREAS.filter((a) => a !== "Other").map((a) => <option key={a} value={a}>{a}, Pokhara</option>)}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute right-4 bottom-3.5 size-4" aria-hidden />
          </label>
        </div>
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Helper list */}
        <section aria-labelledby="helpers" className="space-y-6">
          <div className="space-y-2">
            <h2 id="helpers" className="text-3xl font-semibold tracking-tight sm:text-4xl">Find your helping hand</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {visible.length} helper{visible.length === 1 ? "" : "s"} available
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="bg-card text-muted-foreground rounded-2xl border p-8 text-center">No helpers match these chores and location yet.</p>
          ) : (
            <ul className="space-y-6">
              {visible.map((h) => {
                const selected = h.id === chosenId;
                return (
                  <li
                    key={h.id}
                    className={cn(
                      "bg-card grid gap-5 rounded-2xl border p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6 xl:grid-cols-[auto_minmax(0,1fr)_15rem]",
                      selected && "border-primary/70 border-2"
                    )}
                  >
                    <div aria-hidden className="bg-hero text-primary grid h-36 w-28 place-items-center rounded-xl text-3xl font-semibold sm:h-48 sm:w-40">
                      {initials(h.full_name)}
                    </div>
                    <div className="min-w-0 space-y-3">
                      <h3 className="text-2xl font-semibold">{h.full_name}</h3>
                      <HelperBadge h={h} />
                      {h.bio && <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">{h.bio}</p>}
                      {h.chores.length > 0 && (
                        <ul className="flex flex-wrap gap-2.5 pt-1" aria-label="Chores">
                          {h.chores.map((c) => <li key={c} className="bg-muted rounded-md px-3 py-1.5 text-sm text-[#645b50]">{c}</li>)}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col justify-between gap-4 sm:col-span-2 xl:col-span-1">
                      <p className="text-muted-foreground text-sm">Price open to discussion</p>
                      {selected ? (
                        <p className="bg-success-soft text-success border-success/30 flex h-14 items-center gap-2 rounded-xl border px-5 text-lg font-medium">
                          <Check className="size-5" aria-hidden /> Selected
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => choose(h.id)}
                          className="border-primary/70 text-primary hover:bg-secondary flex h-14 items-center gap-2 rounded-xl border bg-white px-6 text-lg font-semibold"
                        >
                          Choose helper <ArrowRight className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Booking panel */}
        <section aria-labelledby="booking" className="space-y-6 lg:sticky lg:top-28">
          <div className="space-y-2">
            <h2 id="booking" className="text-3xl font-semibold tracking-tight sm:text-4xl">Your booking</h2>
            <p className="text-muted-foreground text-sm sm:text-base">A few details, then a price you both agree on.</p>
          </div>

          <div className="bg-card space-y-6 rounded-2xl border p-6 sm:p-7">
            <div className="space-y-4 border-b pb-6">
              <h3 className="text-2xl font-semibold sm:text-3xl">Let’s plan your help</h3>
              <ol className="flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
                {["Details", "Negotiate", "Confirm"].map((s, i) => (
                  <li key={s} className={cn(i + 1 === step ? "text-primary font-semibold" : "text-muted-foreground", i === 0 && "mr-auto sm:mr-20")}>
                    {i + 1} {s}
                  </li>
                ))}
              </ol>
            </div>

            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.12em] uppercase">Your chosen helper</p>
                  {chosen ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xl font-semibold">{chosen.full_name}</p>
                      <button type="button" onClick={() => setChosenId(null)} className="text-primary font-semibold hover:underline">Change</button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Choose a helper from the list.</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[15px] font-medium">Chores · {chores.length} selected</p>
                  {chores.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Pick chores under “What can we help with?”.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-3">
                      {chores.map((c) => (
                        <li key={c} className="bg-secondary text-secondary-foreground inline-flex items-center gap-3 rounded-md py-2 pr-3 pl-4">
                          {c}
                          <button type="button" aria-label={`Remove ${c}`} onClick={() => toggleChore(c)} className="hover:text-primary">
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="b-title">Title (optional)</Label>
                    <Input id="b-title" className="h-12 rounded-xl bg-white px-4" maxLength={80} placeholder="e.g. Saturday deep clean" value={f.title} onChange={(e) => set("title", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="b-area">Area</Label>
                    <select id="b-area" className="border-input h-12 w-full rounded-xl border bg-white px-4" value={f.area} onChange={(e) => set("area", e.target.value)}>
                      <option value="">Choose area…</option>
                      {AREAS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[15px] font-medium">Booking type</p>
                  <div role="radiogroup" className="bg-accent grid grid-cols-2 gap-1 rounded-xl p-1">
                    {[
                      { v: false, l: "One-time" },
                      { v: true, l: "Recurring" },
                    ].map(({ v, l }) => {
                      const on = f.recurring === v;
                      return (
                        <button
                          key={l}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set("recurring", v)}
                          className={cn(
                            "flex h-11 items-center justify-center gap-2.5 rounded-lg text-base",
                            on ? "border-primary/40 text-primary border bg-white font-semibold" : "text-muted-foreground"
                          )}
                        >
                          <span aria-hidden className={cn("grid size-3.5 place-items-center rounded-full border", on ? "border-primary" : "border-muted-foreground")}>
                            {on && <span className="bg-primary size-2 rounded-full" />}
                          </span>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="b-date">Date</Label>
                    <Input id="b-date" type="date" min={today} className="h-12 rounded-xl bg-white px-4" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="b-time">Time</Label>
                    <Input id="b-time" type="time" className="h-12 rounded-xl bg-white px-4" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="b-address">Home address</Label>
                  <Input id="b-address" className="h-12 rounded-xl bg-white px-4" placeholder="Add your address in Pokhara" value={f.address} onChange={(e) => set("address", e.target.value)} />
                </div>

                <div className="space-y-2 border-t pt-6">
                  <h4 className="text-xl font-semibold">Next: agree on your price</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    A negotiation session lasts 1 minute.
                    <br />
                    Accept, counter, or decline before it expires.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toNegotiate}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-semibold"
                >
                  Continue to negotiation <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            ) : (
              <form onSubmit={startNegotiation} className="space-y-6">
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.12em] uppercase">Negotiating with</p>
                  <p className="text-xl font-semibold">{chosen?.full_name}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{chores.join(", ")} · {f.recurring ? "Recurring" : "One-time"} · {f.area}</p>
                </div>
                <div>
                  <Label htmlFor="b-price">Your opening price (NPR per visit)</Label>
                  <Input
                    id="b-price"
                    inputMode="numeric"
                    required
                    autoFocus
                    className="h-12 rounded-xl bg-white px-4"
                    placeholder={`${PRICE_FLOOR} minimum`}
                    value={f.budget}
                    onChange={(e) => set("budget", e.target.value)}
                  />
                  <p className="text-muted-foreground mt-2 text-sm">Submitting starts the 1-minute session. Accept, counter, or decline before it expires.</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} disabled={pending} className="hover:bg-accent h-14 rounded-xl border bg-white px-5 font-medium">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-semibold disabled:opacity-60"
                  >
                    {pending ? "Starting…" : "Start negotiation"} {!pending && <ArrowRight className="size-4" aria-hidden />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
