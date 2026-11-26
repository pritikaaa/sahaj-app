"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChorePicker } from "./chore-picker";
import { PRICE_FLOOR } from "@/lib/constants";
import { formatNPR } from "@/lib/format";
import { saveProfileAction } from "@/app/actions";
import type { Profile } from "@/lib/types";

/** Lets a person list the services they offer, right from Find work. Saves to their profile. */
export function ServicesForm({ me }: { me: Profile }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    offers_help: true,
    is_student: me.is_student,
    chores: me.chores,
    min_price: me.min_price ? String(me.min_price) : "",
    bio: me.bio ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function save(e: React.FormEvent, offers = f.offers_help) {
    e.preventDefault();
    start(async () => {
      const r = await saveProfileAction({
        full_name: me.full_name,
        phone: me.phone ?? "",
        area: me.area ?? "",
        trusted_contact_name: me.trusted_contact_name ?? "",
        trusted_contact_phone: me.trusted_contact_phone ?? "",
        ...f,
        offers_help: offers,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(offers ? "Your services are listed." : "You've stopped offering help.");
      setEditing(false);
      router.refresh();
    });
  }

  // Already offering help and not editing: short summary.
  if (me.offers_help && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{me.chores.length ? me.chores.join(", ") : "No chores listed yet"}</p>
          <p className="text-muted-foreground text-sm">
            {me.min_price ? `Usual minimum ${formatNPR(me.min_price)} per visit` : "No minimum price set"}
            {me.bio ? ` · ${me.bio}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>Edit services</Button>
        </div>
      </div>
    );
  }

  // Not offering yet and form not opened.
  if (!me.offers_help && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-muted-foreground flex-1">List the chores you can do so families can find and hire you. You can keep hiring too.</p>
        <Button onClick={() => setEditing(true)}>Start offering help <ArrowRight aria-hidden /></Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5" aria-label="Your services">
      <div className="flex items-start gap-3">
        <Switch id="svc_student" checked={f.is_student} onCheckedChange={(v) => set("is_student", v)} />
        <div>
          <Label htmlFor="svc_student">I am a student</Label>
        </div>
      </div>
      <ChorePicker legend="Chores I can do" value={f.chores} onChange={(v) => set("chores", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="svc_min">My usual minimum (NPR per visit)</Label>
          <Input id="svc_min" inputMode="numeric" placeholder={`${PRICE_FLOOR} or more`} value={f.min_price} onChange={(e) => set("min_price", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="svc_bio">About me</Label>
        <Textarea id="svc_bio" maxLength={400} placeholder="Experience, languages, free hours…" value={f.bio} onChange={(e) => set("bio", e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : me.offers_help ? "Save services" : "List my services"}</Button>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button>
        {me.offers_help && (
          <Button type="button" size="lg" variant="ghost" disabled={pending} className="text-muted-foreground ml-auto" onClick={(e) => save(e, false)}>
            Stop offering help
          </Button>
        )}
      </div>
    </form>
  );
}
